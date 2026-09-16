// lib/cashbook/posting-service.ts
// Cash Book Posting Service — Governed posting authority for bank transactions.

import { supabase } from "@/lib/supabase/client";
import { postingEngine } from "@/lib/financial/posting-engine";
import { publish } from "@/lib/platform/events/event-bus";
import { logger } from "@/lib/platform/events/logger.service";
import { classificationEngine } from "./classification-engine";
import type { PostingStatus } from "@/lib/transaction-status";

export interface CashBookPostingResult {
  success: boolean;
  journalId?: string;
  message: string;
  newState: PostingStatus;
}

export const cashbookPostingService = {
  // Posts one fully allocated bank transaction.
  async postTransaction(transactionId: string): Promise<CashBookPostingResult> {
    const { data: txn, error: txnError } = await supabase
      .from("bank_transactions")
      .select("*")
      .eq("id", transactionId)
      .single();

    if (txnError || !txn) {
      return {
        success: false,
        message: "Transaction not found",
        newState: "posting_failed",
      };
    }

    const allocationState = txn.allocation_status || "unallocated";
    const postingState: PostingStatus = txn.posting_status || "not_posted";

    if (postingState === "posted") {
      return {
        success: false,
        message: "Transaction has already been posted.",
        newState: "posted",
      };
    }

    if (postingState === "posting") {
      return {
        success: false,
        message: "Transaction is already being posted.",
        newState: "posting",
      };
    }

    if (allocationState !== "fully_allocated") {
      return {
        success: false,
        message: `Cannot post from allocation state: ${allocationState}`,
        newState: "not_posted",
      };
    }

    const { data: claimedTxn, error: claimError } = await supabase
      .from("bank_transactions")
      .update({
        posting_status: "posting",
        updated_at: new Date().toISOString(),
      })
      .eq("id", transactionId)
      .in("posting_status", ["not_posted", "posting_failed"])
      .select("id")
      .maybeSingle();

    if (claimError) {
      return {
        success: false,
        message: claimError.message,
        newState: postingState,
      };
    }

    if (!claimedTxn) {
      return {
        success: false,
        message: "Transaction could not be claimed for posting.",
        newState: postingState,
      };
    }

    try {
      // Classify the transaction
      const classification = await classificationEngine.classify(txn);

      if (classification.class === "unknown") {
        await supabase
          .from("bank_transactions")
          .update({
            allocation_status: "fully_allocated",
            posting_status: "not_posted",
            queue: "review",
            updated_at: new Date().toISOString(),
          })
          .eq("id", transactionId);
        return {
          success: false,
          message: "Cannot classify transaction — needs manual review",
          newState: "not_posted",
        };
      }

      // Map classification to posting event
      const eventMap: Record<string, { event: string; dimensions: any }> = {
        tenant_receipt: {
          event: "rental_receipt_received",
          dimensions: {
            tenant_id: txn.matched_tenant_id,
            bank_account_id: txn.bank_account_id,
          },
        },
        supplier_payment: {
          event: "supplier_payment_made",
          dimensions: {
            supplier_id: txn.matched_supplier_id,
            bank_account_id: txn.bank_account_id,
          },
        },
        bank_charge: {
          event: "bank_charge_captured",
          dimensions: { bank_account_id: txn.bank_account_id },
        },
        interest_earned: {
          event: "bank_interest_earned",
          dimensions: { bank_account_id: txn.bank_account_id },
        },
        transfer: {
          event: "bank_transfer_made",
          dimensions: { bank_account_id: txn.bank_account_id },
        },
        refund: {
          event: "rental_receipt_received",
          dimensions: {
            tenant_id: txn.matched_tenant_id,
            bank_account_id: txn.bank_account_id,
          },
        },
      };

      const mapping = eventMap[classification.class];
      if (!mapping) {
        await supabase
          .from("bank_transactions")
          .update({
            allocation_status: "fully_allocated",
            posting_status: "not_posted",
            queue: "review",
            updated_at: new Date().toISOString(),
          })
          .eq("id", transactionId);
        return {
          success: false,
          message: "No posting rule for classification",
          newState: "not_posted",
        };
      }

      // Get entity_id from bank account
      const { data: bankAccount } = await supabase
        .from("bank_accounts")
        .select("entity_id")
        .eq("id", txn.bank_account_id)
        .single();
      if (!bankAccount?.entity_id) {
        throw new Error(
          "Cannot post transaction because its bank account has no entity.",
        );
      }

      // Post to engine
      console.log("Posting event with entity_id:", bankAccount?.entity_id, txn);
      const result = await postingEngine.post({
        source_engine: "cashbook",
        business_event: mapping.event,
        entity_id: bankAccount.entity_id,
        amount: Math.abs(txn.transaction_amount),
        occurred_at: txn.transaction_date || new Date().toISOString(),
        effective_date:
          txn.transaction_date?.split("T")[0] ||
          new Date().toISOString().split("T")[0],
        dimensions: mapping.dimensions,
        metadata: {
          source_id: txn.id,
          reference: txn.transaction_reference || "",
          description: txn.transaction_description || classification.reason,
          classification: classification.class,
          confidence: classification.confidence,
          created_by: "cashbook-posting-service",
        },
      });

      // The journal is authoritative and idempotent by source event + source ID.
      // Use its persisted ID for all downstream provenance and recovery.
      const persistedJournalId = result.journal?.id;

      if (!persistedJournalId) {
        throw new Error("Posting succeeded without a persisted journal ID");
      }

      // Update statements_generated with the receipt line.
      // source_journal_id provides the database-level idempotency boundary so
      // retries cannot append the same receipt twice.
      if (
        mapping.event === "rental_receipt_received" &&
        mapping.dimensions?.tenant_id
      ) {
        const {
          data: existingStatementMutation,
          error: existingMutationError,
        } = await supabase
          .from("statements_generated")
          .select("id")
          .eq("source_journal_id", persistedJournalId)
          .maybeSingle();

        if (existingMutationError) {
          throw new Error(
            `Failed checking receipt statement idempotency: ${existingMutationError.message}`,
          );
        }

        if (!existingStatementMutation) {
          const { data: stmt, error: statementFetchError } = await supabase
            .from("statements_generated")
            .select("id, statement_data")
            .eq("entity_id", bankAccount?.entity_id)
            .eq("tenant_id", mapping.dimensions.tenant_id)
            .order("generated_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (statementFetchError) {
            throw new Error(
              `Failed loading tenant statement: ${statementFetchError.message}`,
            );
          }

          if (stmt?.statement_data) {
            const lines = stmt.statement_data.posted_lines || [];
            const currentBalance =
              lines.length > 0 ? lines[lines.length - 1].balance : 0;
            const newBalance =
              currentBalance - Math.abs(txn.transaction_amount);
            const nextVersion = (stmt.statement_data?.version || 1) + 1;

            lines.push({
              date:
                txn.transaction_date?.split("T")[0] ||
                new Date().toISOString().split("T")[0],
              description: txn.transaction_description || "Receipt",
              reference: txn.transaction_reference || "",
              debit: 0,
              credit: Math.abs(txn.transaction_amount),
              balance: newBalance,
              section: "posted",
            });

            const { error: statementInsertError } = await supabase
              .from("statements_generated")
              .insert({
                entity_id: bankAccount?.entity_id,
                tenant_id: mapping.dimensions.tenant_id,
                statement_data: {
                  ...stmt.statement_data,
                  posted_lines: lines,
                  closing_balance: newBalance,
                  version: nextVersion,
                },
                version: nextVersion,
                status: "draft",
                generated_at: new Date().toISOString(),
                source_journal_id: persistedJournalId,
              });

            if (statementInsertError) {
              if (statementInsertError.code === "23505") {
                const {
                  data: concurrentMutation,
                  error: concurrentLookupError,
                } = await supabase
                  .from("statements_generated")
                  .select("id")
                  .eq("source_journal_id", persistedJournalId)
                  .maybeSingle();

                if (concurrentLookupError || !concurrentMutation) {
                  throw new Error(
                    `Statement receipt insert conflicted but matching idempotent mutation was not found: ${statementInsertError.message}`,
                  );
                }
              } else {
                throw new Error(
                  `Failed saving tenant statement receipt: ${statementInsertError.message}`,
                );
              }
            }
          }
        }
      }

      // Only mark the Cash Book transaction posted after all downstream
      // posting work has completed successfully.
      const { error: bankTransactionUpdateError } = await supabase
        .from("bank_transactions")
        .update({
          allocation_status: "fully_allocated",
          posting_status: "posted",
          queue: "posted",
          matched_journal_id: persistedJournalId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", transactionId);

      if (bankTransactionUpdateError) {
        throw new Error(
          `Journal posted but Cash Book state update failed: ${bankTransactionUpdateError.message}`,
        );
      }

      await publish("cashbook.transaction.posted", {
        correlationId: crypto.randomUUID(),
        source: "cashbook-posting-service",
        version: "1.0",
        payload: {
          transactionId,
          journalId: result.journal?.id,
          classification: classification.class,
        },
      });

      return {
        success: true,
        journalId: result.journal?.id,
        message: "Posted to General Ledger",
        newState: "posted",
      };
    } catch (error) {
      await supabase
        .from("bank_transactions")
        .update({
          posting_status: "posting_failed",
          queue: "exceptions",
          updated_at: new Date().toISOString(),
        })
        .eq("id", transactionId);
      logger.error("Cash Book posting failed", { transactionId, error });
      return {
        success: false,
        message: error instanceof Error ? error.message : "Posting failed",
        newState: "posting_failed",
      };
    }
  },

  // Bulk post — explicit governed action from the Cash Book UI.
  async postReadyTransactions(
    entityId: string,
    accountId?: string,
  ): Promise<{ posted: number; failed: number }> {
    let query = supabase
      .from("bank_transactions")
      .select("id, bank_accounts!inner(entity_id)")
      .eq("bank_accounts.entity_id", entityId)
      .eq("allocation_status", "fully_allocated")
      .eq("posting_status", "not_posted")
      .eq("queue", "ready");
    if (accountId) query = query.eq("bank_account_id", accountId);
    const { data: readyTxns } = await query;
    if (!readyTxns?.length) return { posted: 0, failed: 0 };

    let posted = 0,
      failed = 0;
    for (const txn of readyTxns) {
      const result = await this.postTransaction(txn.id);
      if (result.success) posted++;
      else failed++;
    }
    return { posted, failed };
  },
};
