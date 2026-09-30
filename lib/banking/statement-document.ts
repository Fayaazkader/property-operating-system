import type { SupabaseClient } from "@supabase/supabase-js";

interface RegisterStatementDocumentParams {
  db: SupabaseClient;
  file: File;
  fileBuffer: ArrayBuffer;
  checksum: string;
  entityId: string;
  statementId: string;
  uploadedBy: string;
}

export async function registerStatementDocument({
  db,
  file,
  fileBuffer,
  checksum,
  entityId,
  statementId,
  uploadedBy,
}: RegisterStatementDocumentParams): Promise<{
  documentId: string;
  storageKey: string;
}> {
  const documentId = crypto.randomUUID();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storageKey =
    `bank-statements/${entityId}/${statementId}/${documentId}-${safeName}`;

  const { error: uploadError } = await db.storage
    .from("bank-statement-evidence")
    .upload(storageKey, fileBuffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Statement upload failed: ${uploadError.message}`);
  }

  try {
    const { error: documentError } = await db.from("documents").insert({
      id: documentId,
      entity_id: entityId,
      file_name: file.name,
      mime_type: file.type || "application/octet-stream",
      file_size_bytes: fileBuffer.byteLength,
      storage_provider: "supabase",
      storage_bucket: "bank-statement-evidence",
      storage_key: storageKey,
      storage_version: "v1",
      checksum,
      document_type: "bank_statement_source",
      status: "received",
      requires_review: true,
      source: "upload",
      uploaded_by: uploadedBy,
    });

    if (documentError) throw documentError;

    const { error: relationshipError } = await db
      .from("document_relationships")
      .insert({
        document_id: documentId,
        related_entity_type: "bank_statement",
        related_entity_id: statementId,
        relationship_type: "source_document",
      });

    if (relationshipError) throw relationshipError;

    return { documentId, storageKey };
  } catch (error) {
    const { error: documentCleanupError } = await db
      .from("documents")
      .delete()
      .eq("id", documentId);

    const { error: storageCleanupError } = await db.storage
      .from("bank-statement-evidence")
      .remove([storageKey]);

    if (documentCleanupError || storageCleanupError) {
      throw new Error(
        `Statement document registration failed and cleanup was incomplete: ${
          error instanceof Error ? error.message : String(error)
        }. Document cleanup: ${
          documentCleanupError?.message || "completed"
        }. Storage cleanup: ${
          storageCleanupError?.message || "completed"
        }.`,
      );
    }

    throw error;
  }
}
