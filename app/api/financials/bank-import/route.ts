import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { importBankStatement } from "@/lib/banking/import-engine";
import { validateBankImport } from "@/lib/banking/import-validation";
import { validateBankStatementGovernance } from "@/lib/banking/import-governance";
import { validateBankImportFinancialPeriod } from "@/lib/banking/financial-period-governance";
import { runReconciliationEngine } from "@/lib/banking/reconciliation-engine";
import { detectBankImport } from "@/lib/banking/import-detection";
import { matchBankAccount } from "@/lib/banking/account-detection";
import { registerStatementDocument } from "@/lib/banking/statement-document";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accessToken = authHeader.slice(7);

    const authClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    );

    const {
      data: { user },
    } = await authClient.auth.getUser(accessToken);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );

    const formData = await request.formData();

    const file = formData.get("file");
    const entityId = formData.get("entityId")?.toString();
    const bankAccountId = formData.get("bankAccountId")?.toString();
    const presetRaw = formData.get("preset")?.toString();

    if (!(file instanceof File) || !entityId || !bankAccountId) {
      return NextResponse.json(
        {
          error: "file, entityId, and bankAccountId are required",
        },
        { status: 400 },
      );
    }

    let preset: any = null;

    if (presetRaw) {
      try {
        preset = JSON.parse(presetRaw);
      } catch {
        return NextResponse.json(
          { error: "Invalid import preset." },
          { status: 400 },
        );
      }
    }

    /*
     * Explicit entity access check.
     */
    const { data: access } = await supabase
      .from("user_entity_access")
      .select("entity_id")
      .eq("user_id", user.id)
      .eq("entity_id", entityId)
      .single();

    if (!access) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    /*
     * Verify the selected bank account belongs to the
     * authenticated user's entity.
     */
    const { data: bankAccount } = await supabase
      .from("bank_accounts")
      .select("id, entity_id, bank_name, account_name, account_number")
      .eq("id", bankAccountId)
      .eq("entity_id", entityId)
      .eq("is_active", true)
      .single();

    if (!bankAccount) {
      return NextResponse.json(
        { error: "Bank account not found or access denied." },
        { status: 404 },
      );
    }

    /*
     * Detection is performed server-side because document
     * processing may involve binary/OCR formats.
     *
     * CSV detection remains useful for structured imports.
     * Binary formats are ultimately handled by Document Intelligence.
     */
    let detection: any = null;

    try {
      const fileText = await file.text();

      detection = detectBankImport(fileText);

      const accountMatch = await matchBankAccount(
        detection.accountNumber,
        detection.bankName,
        entityId,
      );

      if (accountMatch && accountMatch.id !== bankAccountId) {
        return NextResponse.json(
          {
            error:
              "The bank account detected in the statement does not match the selected AssetFlow bank account.",
          },
          { status: 400 },
        );
      }
    } catch {
      /*
       * Binary statements may not have meaningful text at this
       * stage. Document Intelligence remains authoritative.
       */
      detection = null;
    }

    /*
     * Build the existing preset structure when structured
     * detection is available.
     */
    const importPreset =
      detection && (preset || detection.confidence >= 80)
        ? preset
          ? {
              ...preset,
              transaction_header_row: detection.transactionHeaderRow,
              column_mapping: {
                ...preset.column_mapping,
                ...(detection.dateColumn ? { date: detection.dateColumn } : {}),
                ...(detection.descriptionColumn
                  ? { description: detection.descriptionColumn }
                  : {}),
                ...(detection.referenceColumn
                  ? { reference: detection.referenceColumn }
                  : {}),
                ...(detection.amountColumn
                  ? { amount: detection.amountColumn }
                  : {}),
                ...(detection.debitColumn
                  ? { debit: detection.debitColumn }
                  : {}),
                ...(detection.creditColumn
                  ? { credit: detection.creditColumn }
                  : {}),
              },
              date_format: detection.dateFormat || preset.date_format,
              amount_type: detection.amountType || preset.amount_type,
            }
          : {
              column_mapping: {
                ...(detection.dateColumn ? { date: detection.dateColumn } : {}),
                ...(detection.descriptionColumn
                  ? { description: detection.descriptionColumn }
                  : {}),
                ...(detection.referenceColumn
                  ? { reference: detection.referenceColumn }
                  : {}),
                ...(detection.amountColumn
                  ? { amount: detection.amountColumn }
                  : {}),
                ...(detection.debitColumn
                  ? { debit: detection.debitColumn }
                  : {}),
                ...(detection.creditColumn
                  ? { credit: detection.creditColumn }
                  : {}),
              },
              amount_type: detection.amountType,
              date_format: detection.dateFormat || "DD/MM/YYYY",
              skip_rows: 0,
              transaction_header_row: detection.transactionHeaderRow,
            }
        : preset;

    /*
     * Validation is server-side.
     */
    const validation = await validateBankImport(file, importPreset);

    if (!validation.valid) {
      return NextResponse.json(
        {
          error: validation.errors.join(" · "),
          validation,
        },
        { status: 400 },
      );
    }

    /*
     * Document Intelligence + existing bank import engine.
     */
    const result = await importBankStatement(file, importPreset);

    if (!result.success || !result.data) {
      return NextResponse.json(
        {
          error: result.error || "Bank statement could not be processed.",
        },
        { status: 400 },
      );
    }

    const {
      transactions,
      startDate,
      endDate,
      openingBalance,
      closingBalance,
      statementDate,
    } = result.data;

    /*
     * Financial period governance.
     */
    const periodValidation = await validateBankImportFinancialPeriod(
      entityId,
      startDate,
      endDate,
    );

    if (!periodValidation.valid) {
      return NextResponse.json(
        {
          error:
            periodValidation.reason ||
            "Bank import is outside the open financial period.",
        },
        { status: 400 },
      );
    }

    /*
     * Statement continuity / overlap governance.
     */
    const governanceValidation = await validateBankStatementGovernance(
      bankAccountId,
      openingBalance,
      startDate,
      endDate,
    );

    if (!governanceValidation.valid) {
      return NextResponse.json(
        {
          error:
            governanceValidation.reason ||
            "Bank statement governance validation failed.",
        },
        { status: 400 },
      );
    }

    /*
     * Verify source opening + transactions = source closing.
     */
    if (openingBalance !== null && closingBalance !== null) {
      const transactionMovement = transactions.reduce(
        (sum, tx) => sum + (tx.amount || 0),
        0,
      );

      const calculatedClosing =
        Math.round((openingBalance + transactionMovement) * 100) / 100;

      const difference =
        Math.round((calculatedClosing - closingBalance) * 100) / 100;

      if (Math.abs(difference) > 0.01) {
        return NextResponse.json(
          {
            error:
              `Bank statement balance validation failed. ` +
              `Difference: R${difference.toLocaleString("en-ZA", {
                minimumFractionDigits: 2,
              })}.`,
          },
          { status: 400 },
        );
      }
    }

    /*
     * Stable batch reference from the original file bytes.
     */
    const fileBuffer = await file.arrayBuffer();

    const digest = await crypto.subtle.digest("SHA-256", fileBuffer);

    const batchRef = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    /*
     * Duplicate protection.
     */
    const { data: existing } = await supabase
      .from("bank_transactions")
      .select("id")
      .eq("imported_batch_reference", batchRef)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json(
        {
          error:
            "This bank statement has already been imported. Duplicate detected.",
        },
        { status: 409 },
      );
    }
    /*
     * Statement-level duplicate protection.
     *
     * A statement is uniquely identified by bank account + statement date.
     * This protects against the same statement being supplied as a
     * different file, and also handles statements created before any
     * transaction rows exist.
     */
    const governedStatementDate = statementDate || endDate;

    const { data: existingStatement, error: existingStatementError } =
      await supabase
        .from("bank_statements")
        .select("id, statement_date")
        .eq("bank_account_id", bankAccountId)
        .eq("statement_date", governedStatementDate)
        .maybeSingle();

    if (existingStatementError) {
      throw new Error(
        `Unable to verify whether this bank statement already exists: ${existingStatementError.message}`,
      );
    }

    if (existingStatement) {
      return NextResponse.json(
        {
          error:
            `This bank statement has already been imported for this account ` +
            `with statement date ${governedStatementDate}. Duplicate detected.`,
          code: "BANK_STATEMENT_ALREADY_IMPORTED",
          statementId: existingStatement.id,
        },
        { status: 409 },
      );
    }

    /*
     * Validate persistence invariants before writing anything.
     */
    for (const tx of transactions) {
      if (typeof tx.amount !== "number" || !Number.isFinite(tx.amount)) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Bank statement contains a transaction with an invalid amount. Nothing was imported.",
            code: "INVALID_TRANSACTION_AMOUNT",
          },
          { status: 400 },
        );
      }

      if (!tx.transactionDate) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Bank statement contains a transaction with an invalid date. Nothing was imported.",
            code: "INVALID_TRANSACTION_DATE",
          },
          { status: 400 },
        );
      }
    }

    /*
     * Create governed statement.
     */
    const { data: statement, error: statementError } = await supabase
      .from("bank_statements")
      .insert({
        bank_account_id: bankAccountId,
        entity_id: entityId,
        statement_date: governedStatementDate,
        opening_balance: openingBalance,
        closing_balance: closingBalance,
        status: "imported",
      })
      .select("id")
      .single();

    if (statementError || !statement) {
      throw new Error(
        statementError?.message || "The bank statement could not be created.",
      );
    }

    /*
     * Preserve the original bank-issued statement as supporting evidence.
     * Registration must succeed before transaction insertion.
     * Coverage remains unverified until authorised human review.
     */
    let statementDocument: Awaited<
      ReturnType<typeof registerStatementDocument>
    >;

    try {
      statementDocument = await registerStatementDocument({
        db: supabase,
        file,
        fileBuffer,
        checksum: batchRef,
        entityId,
        statementId: statement.id,
        uploadedBy: user.id,
      });
    } catch (registrationError) {
      const { error: statementCleanupError } = await supabase
        .from("bank_statements")
        .delete()
        .eq("id", statement.id);

      if (statementCleanupError) {
        throw new Error(
          `Document registration failed and statement cleanup was incomplete: ${
            registrationError instanceof Error
              ? registrationError.message
              : String(registrationError)
          }. Statement cleanup: ${statementCleanupError.message}`,
        );
      }

      throw registrationError;
    }

    /*
     * Roll back every artifact created by this import.
     * Delete the relationship before its document and storage object.
     */
    const rollbackImport = async (): Promise<void> => {
      const { error: transactionsError } = await supabase
        .from("bank_transactions")
        .delete()
        .eq("imported_batch_reference", batchRef)
        .eq("statement_id", statement.id);

      if (transactionsError) {
        throw new Error(
          `Import rollback stopped: transaction cleanup failed. ` +
          `Statement and evidence retained for investigation: ` +
          transactionsError.message,
        );
      }

      const { error: relationshipError } = await supabase
        .from("document_relationships")
        .delete()
        .eq("document_id", statementDocument.documentId)
        .eq("related_entity_type", "bank_statement")
        .eq("related_entity_id", statement.id);

      if (relationshipError) {
        throw new Error(
          `Import rollback stopped: relationship cleanup failed. ` +
          `Statement and evidence retained: ${relationshipError.message}`,
        );
      }

      const { error: documentError } = await supabase
        .from("documents")
        .delete()
        .eq("id", statementDocument.documentId);

      if (documentError) {
        throw new Error(
          `Import rollback stopped: document cleanup failed. ` +
          `Statement and storage object retained: ${documentError.message}`,
        );
      }

      const { error: storageError } = await supabase.storage
        .from("bank-statement-evidence")
        .remove([statementDocument.storageKey]);

      if (storageError) {
        throw new Error(
          `Import rollback incomplete: private storage cleanup failed. ` +
          `Statement retained: ${storageError.message}`,
        );
      }

      const { error: statementError } = await supabase
        .from("bank_statements")
        .delete()
        .eq("id", statement.id);

      if (statementError) {
        throw new Error(
          `Import rollback incomplete: statement cleanup failed: ` +
          statementError.message,
        );
      }
    };

    /*
     * Save canonical bank transactions.
     */
    for (const tx of transactions) {
      const { error: upsertError } = await supabase
        .from("bank_transactions")
        .upsert({
          id: tx.id,
          transaction_date: tx.transactionDate || null,
          transaction_description: tx.description || null,
          transaction_amount: tx.amount,
          transaction_reference: tx.reference || null,
          bank_account_name: bankAccount.bank_name || null,
          bank_account_id: bankAccountId,
          bank_account_number: bankAccount.account_number || null,
          allocation_status: "unallocated",
          split_allocations: tx.splitAllocations || [],
          queue: "review",
          posting_status: "not_posted",
          imported_batch_reference: batchRef,
          imported_at: new Date().toISOString(),
          statement_id: statement.id,
        });

      if (upsertError) {
        await rollbackImport();
        throw new Error(`Transaction import failed: ${upsertError.message}`);
      }
    }

    /*
     * Update account balance only when the source supplied
     * a verified closing balance.
     */
    if (closingBalance !== null) {
      const { error: balanceError } = await supabase
        .from("bank_accounts")
        .update({
          current_balance: closingBalance,
          statement_balance: closingBalance,
        })
        .eq("id", bankAccountId);

      if (balanceError) {
        await rollbackImport();
        throw new Error(
          `Bank import failed during account balance update: ${balanceError.message}`,
        );
      }
    }

    /*
     * Reconciliation remains separate from posting.
     */
    let recon: Awaited<ReturnType<typeof runReconciliationEngine>> | null = null;
    let reconciliationWarning: string | null = null;

    try {
      recon = await runReconciliationEngine(entityId);
    } catch (error) {
      reconciliationWarning =
        error instanceof Error ? error.message : "Reconciliation failed";

      console.error(
        "Bank statement imported, but reconciliation failed:",
        error,
      );
    }

    return NextResponse.json({
      success: true,
      result: {
        ...result,
        batchRef,
        statementId: statement.id,
        documentId: statementDocument.documentId,
        reconciliation: recon,
        reconciliationWarning,
      },
    });
  } catch (error: any) {
    console.error("Bank statement import API error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Bank statement import failed.",
      },
      { status: 500 },
    );
  }
}
