// lib/financial/sub-ledger-engine.ts
// Sub-Ledger Engine — Operational ledgers backed by journal lines

import { supabase } from "@/lib/supabase";
import type { SubLedgerEntry, LedgerQuery, Journal } from "./types";

export class SubLedgerEngine {
  async postToSubLedgers(journal: Journal): Promise<void> {
    for (const line of journal.lines || []) {
      const entries: Partial<SubLedgerEntry>[] = [];

      if (line.tenant_id) {
        entries.push(
          await this.buildEntry(journal, line, "tenant", line.tenant_id),
        );
      }

      if (line.supplier_id) {
        entries.push(
          await this.buildEntry(
            journal,
            line,
            "supplier",
            undefined,
            line.supplier_id,
          ),
        );
      }

      if (line.broker_id) {
        entries.push(
          await this.buildEntry(
            journal,
            line,
            "broker",
            undefined,
            undefined,
            line.broker_id,
          ),
        );
      }

      const { data: account } = await supabase
        .from("chart_of_accounts")
        .select("account_name")
        .eq("id", line.account_id)
        .single();

      if (account?.account_name?.toLowerCase().includes("bank")) {
        if (!line.bank_account_id) {
          throw new Error(
            `Cannot create bank sub-ledger entry for journal line ${line.id}: bank_account_id is missing.`,
          );
        }

        entries.push(await this.buildEntry(journal, line, "bank"));
      }

      for (const entry of entries) {
        if (!entry.journal_line_id || !entry.ledger_type) {
          throw new Error(
            "Cannot create sub-ledger entry without journal_line_id and ledger_type.",
          );
        }

        /*
         * Application-level idempotency.
         *
         * A posting retry must not create another operational ledger
         * movement for the same journal line and ledger type.
         */
        const { data: existing } = await supabase
          .from("sub_ledger_entries")
          .select("id")
          .eq("journal_line_id", entry.journal_line_id)
          .eq("ledger_type", entry.ledger_type)
          .maybeSingle();

        if (existing?.id) {
          continue;
        }

        const idField = entry.tenant_id
          ? "tenant_id"
          : entry.supplier_id
            ? "supplier_id"
            : entry.broker_id
              ? "broker_id"
              : "bank_account_id";

        const idValue =
          entry.tenant_id ||
          entry.supplier_id ||
          entry.broker_id ||
          entry.bank_account_id ||
          "";

        const { data: last } = await supabase
          .from("sub_ledger_entries")
          .select("running_balance")
          .eq("entity_id", entry.entity_id)
          .eq("ledger_type", entry.ledger_type)
          .eq(idField, idValue)
          .order("posted_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const prevBalance = last?.running_balance || 0;
        const change = (entry.debit_amount || 0) - (entry.credit_amount || 0);

        entry.running_balance = prevBalance + change;

        /*
         * Database-level uniqueness is the final protection against
         * concurrent retries racing between the lookup and insert.
         */
        const { error: insertError } = await supabase
          .from("sub_ledger_entries")
          .insert(entry);

        if (insertError) {
          const { data: concurrentEntry } = await supabase
            .from("sub_ledger_entries")
            .select("id")
            .eq("journal_line_id", entry.journal_line_id)
            .eq("ledger_type", entry.ledger_type)
            .maybeSingle();

          if (concurrentEntry?.id) {
            continue;
          }

          throw insertError;
        }
      }
    }
  }

  private async buildEntry(
    journal: Journal,
    line: any,
    ledgerType: string,
    tenantId?: string,
    supplierId?: string,
    brokerId?: string,
  ): Promise<Partial<SubLedgerEntry>> {
    return {
      id: crypto.randomUUID(),
      entity_id: journal.entity_id,
      ledger_type: ledgerType,
      journal_line_id: line.id,
      account_id: line.account_id,
      reference_type: journal.reference ? "invoice" : journal.source_event,
reference_id: journal.reference || journal.id,
      description: line.description,
      debit_amount: line.debit_amount,
      credit_amount: line.credit_amount,
      running_balance: 0,
      tenant_id: tenantId || line.tenant_id || null,
      supplier_id: supplierId || line.supplier_id || null,
      broker_id: brokerId || line.broker_id || null,
      bank_account_id: line.bank_account_id || null,
      property_id: line.property_id || null,
      lease_id: line.lease_id || null,
      posted_at: new Date().toISOString(),
    };
  }

  async queryLedger(query: LedgerQuery): Promise<SubLedgerEntry[]> {
    let dbQuery = supabase
      .from("sub_ledger_entries")
      .select("*")
      .eq("entity_id", query.entity_id)
      .eq("ledger_type", query.ledger_type)
      .order("posted_at", { ascending: true });

    if (query.tenant_id) {
      dbQuery = dbQuery.eq("tenant_id", query.tenant_id);
    }

    if (query.supplier_id) {
      dbQuery = dbQuery.eq("supplier_id", query.supplier_id);
    }

    if (query.broker_id) {
      dbQuery = dbQuery.eq("broker_id", query.broker_id);
    }

    if (query.bank_account_id) {
      dbQuery = dbQuery.eq("bank_account_id", query.bank_account_id);
    }

    if (query.property_id) {
      dbQuery = dbQuery.eq("property_id", query.property_id);
    }

    if (query.from_date) {
      dbQuery = dbQuery.gte("posted_at", query.from_date);
    }

    if (query.to_date) {
      dbQuery = dbQuery.lte("posted_at", query.to_date);
    }

    const { data } = await dbQuery;
    return (data || []) as SubLedgerEntry[];
  }

  async getBalance(
    entityId: string,
    ledgerType: string,
    dimensionId: string,
    dimensionField: string,
  ): Promise<number> {
    const { data } = await supabase
      .from("sub_ledger_entries")
      .select("running_balance")
      .eq("entity_id", entityId)
      .eq("ledger_type", ledgerType)
      .eq(dimensionField, dimensionId)
      .order("posted_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return data?.running_balance || 0;
  }
}

export const subLedgerEngine = new SubLedgerEngine();
