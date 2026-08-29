// lib/services/activation.service.ts
// Canonical Lease Activation Service
// The database RPC owns the atomic activation transaction.
// This service validates the request, calls the RPC, and maps the result.

import { supabase } from "@/lib/supabase";
import { logger } from "@/lib/platform/events/logger.service";

export interface ActivationResult {
  success: boolean;
  leaseId?: string;
  intakeId: string;
  error?: string;
}

interface ActivateLeaseRpcResult {
  success: boolean;
  lease_id?: string;
  lease_code?: string;
  billing_rule_id?: string;
  deposit_id?: string;
  message?: string;
}

export class ActivationService {
  private supabase = supabase;

  async activate(
    intakeId: string,
    initiatedBy?: string
  ): Promise<ActivationResult> {
    try {
      // 1. Validate intake ID
      if (!intakeId) {
        return {
          success: false,
          intakeId,
          error: "Intake ID is required",
        };
      }

      // 2. Fetch intake so we can validate that it exists
      //    and prevent re-activation of an already activated intake.
      const { data: intake, error: intakeError } = await this.supabase
        .from("lease_intake")
        .select("id, status")
        .eq("id", intakeId)
        .single();

      if (intakeError || !intake) {
        return {
          success: false,
          intakeId,
          error: "Intake not found",
        };
      }

      if (intake.status === "activated") {
        return {
          success: false,
          intakeId,
          error: "This lease intake has already been activated.",
        };
      }

      // 3. Canonical activation boundary.
      //    The RPC performs the entire activation atomically:
      //    - creates the lease
      //    - activates the intake
      //    - creates the billing rule
      //    - creates the deposit register
      //    - updates unit occupancy
      //    - writes the lease timeline event
      const { data, error } = await this.supabase.rpc(
        "activate_lease_rpc",
        {
          p_intake_id: intakeId,
          p_initiated_by: initiatedBy ?? "system",
        }
      );

      if (error) {
        logger.error("Lease activation RPC failed", {
          intakeId,
          initiatedBy,
          error,
        });

        return {
          success: false,
          intakeId,
          error: error.message,
        };
      }

      const result = data as ActivateLeaseRpcResult;

      if (!result?.success) {
        return {
          success: false,
          intakeId,
          error: result?.message || "Lease activation failed",
        };
      }

      if (!result.lease_id) {
        logger.error("Lease activation RPC returned no lease ID", {
          intakeId,
          result,
        });

        return {
          success: false,
          intakeId,
          error: "Lease activation completed without returning a lease ID.",
        };
      }

      logger.info("Lease activated", {
        leaseId: result.lease_id,
        intakeId,
        initiatedBy,
      });

      return {
        success: true,
        leaseId: result.lease_id,
        intakeId,
      };
    } catch (error) {
      logger.error("Activation service error", {
        error,
        intakeId,
        initiatedBy,
      });

      return {
        success: false,
        intakeId,
        error:
          error instanceof Error ? error.message : "Unknown activation error",
      };
    }
  }
}

export const activationService = new ActivationService();