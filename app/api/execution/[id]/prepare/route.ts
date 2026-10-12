import { NextRequest, NextResponse } from "next/server";
import { ExecutionAccessError, requireExecutionAuthority } from "@/lib/execution/server/authority";
import { executionServiceClient } from "@/lib/execution/server/verification-api";
import { loadVerifiedExecutionSource } from "@/lib/execution/server/document-source";
import { convertExecutionDocument } from "@/lib/execution/server/document-conversion";
import { storeAndCommitSigningDocument } from "@/lib/execution/server/signing-document-storage";
import { PERMISSIONS } from "@/lib/rbac/permissions";

export const runtime = "nodejs";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    if (!UUID.test(id)) {
      return NextResponse.json(
        { error: "Invalid execution ID" },
        { status: 400 }
      );
    }

    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      return NextResponse.json(
        { error: "Execution preparation unavailable" },
        { status: 503 }
      );
    }

    const service = executionServiceClient();

    const { data: execution, error: executionError } = await service
      .from("executions")
      .select("id, source_type, source_id, version, status, is_locked, sha_hash, deleted_at")
      .eq("id", id)
      .maybeSingle();

    if (executionError || !execution) {
      return NextResponse.json(
        { error: "Execution not found" },
        { status: 404 }
      );
    }

    if (execution.source_type !== "leasing_opportunity") {
      return NextResponse.json(
        { error: "Unsupported execution source" },
        { status: 409 }
      );
    }

    const { data: version, error: versionError } = await service
      .from("execution_document_versions")
      .select("id, entity_id, document_id, document_checksum")
      .eq("execution_id", id)
      .eq("version", execution.version)
      .eq("status", "active")
      .maybeSingle();

    if (versionError || !version?.entity_id ||
        !version.document_id || !version.document_checksum) {
      return NextResponse.json(
        { error: "Approved execution version unavailable" },
        { status: 409 }
      );
    }

    const { data: opportunity } = await service
      .from("leasing_opportunities")
      .select("id")
      .eq("id", execution.source_id)
      .eq("entity_id", version.entity_id)
      .maybeSingle();

    if (!opportunity) {
      return NextResponse.json(
        { error: "Execution authority mismatch" },
        { status: 409 }
      );
    }

    const authority = await requireExecutionAuthority(
      authorization,
      version.entity_id,
      PERMISSIONS.LEASING.EXECUTION_SEND
    );

    const { data: locked, error: lockError } = await service.rpc(
      "lock_governed_execution_for_preparation",
      {
        p_execution_id: id,
        p_actor_id: authority.actorId,
      }
    );

    if (lockError || !Array.isArray(locked) || locked.length !== 1) {
      console.error("Execution preparation lock failed", lockError);
      return NextResponse.json(
        { error: "Execution cannot be prepared" },
        { status: 409 }
      );
    }

    const frozen = locked[0];

    if (
      frozen.document_version_id !== version.id ||
      frozen.source_document_id !== version.document_id ||
      frozen.source_checksum !== version.document_checksum ||
      frozen.entity_id !== version.entity_id
    ) {
      return NextResponse.json(
        { error: "Execution changed during preparation" },
        { status: 409 }
      );
    }

    const { data: existing } = await service
      .from("execution_signing_documents")
      .select("id, pdf_checksum, page_count")
      .eq("execution_id", id)
      .eq("document_version_id", version.id)
      .eq("status", "committed")
      .maybeSingle();

    if (existing) {
      const { data: committed, error: committedError } = await service
        .from("execution_signing_documents")
        .select("source_document_id, source_checksum, entity_id")
        .eq("id", existing.id)
        .eq("status", "committed")
        .maybeSingle();

      if (
        committedError ||
        !committed ||
        committed.source_document_id !== frozen.source_document_id ||
        committed.source_checksum !== frozen.source_checksum ||
        committed.entity_id !== frozen.entity_id
      ) {
        return NextResponse.json(
          { error: "Prepared document does not match approved source" },
          { status: 409 }
        );
      }

      return NextResponse.json({
        status: "prepared",
        executionId: id,
        signingDocumentId: existing.id,
        pdfChecksum: existing.pdf_checksum,
        pageCount: existing.page_count,
      });
    }

    const source = await loadVerifiedExecutionSource(service, {
      entityId: version.entity_id,
      documentId: version.document_id,
      expectedChecksum: version.document_checksum,
      allowedDocumentTypes: ["generated_lease"],
    });

    const converted = await convertExecutionDocument({
      bytes: source.bytes,
      format: source.format,
      expectedSourceChecksum: source.checksum,
      filename: source.fileName,
    });

    const prepared = await storeAndCommitSigningDocument(service, {
      executionId: id,
      documentVersionId: version.id,
      entityId: version.entity_id,
      sourceDocumentId: version.document_id,
      sourceChecksum: source.checksum,
      pdfBytes: converted.pdfBytes,
      pdfChecksum: converted.pdfChecksum,
      pageCount: converted.pageCount,
      conversionProvider: converted.conversionProvider,
    });

    return NextResponse.json({
      status: "prepared",
      executionId: id,
      signingDocumentId: prepared.signingDocumentId,
      pdfChecksum: prepared.pdfChecksum,
      pageCount: converted.pageCount,
    });
  } catch (error) {
    if (error instanceof ExecutionAccessError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    console.error("Execution preparation failed", error);

    return NextResponse.json(
      { error: "Execution preparation failed" },
      { status: 500 }
    );
  }
}
