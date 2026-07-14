// lib/brokerage/lifecycles/commission.lifecycle.ts
// Commission Lifecycle — Owns commission operations

import { publish } from "@/lib/platform/events";
import { logger } from "@/lib/platform/events/logger.service";
import { OperationResult } from "@/lib/platform/types";
import { commissionService } from '../commissions/commission.service';
import { commissionCalculator } from '../commissions/commission-calculator';

export class CommissionLifecycle {
  async calculateAndCreateCommission(
    params: {
      broker_id: string;
      lease_id: string;
      mandate_id?: string;
      vacancy_id?: string;
      commission_type: 'percentage' | 'fixed' | 'tiered';
      commission_rate: number;
      annual_rent: number;
      lease_term_months: number;
      split_percentage?: number;
      notes?: string;
    },
    entityId: string,
    correlationId: string = crypto.randomUUID()
  ): Promise<OperationResult<any>> {
    const calculation = commissionCalculator.calculate({
      ...params,
      annual_rent: params.annual_rent,
      lease_term_months: params.lease_term_months,
    });

    const result = await commissionService.create(
      {
        ...params,
        annual_rent: params.annual_rent,
        lease_term_months: params.lease_term_months,
      },
      entityId,
      calculation.snapshot
    );

    if (result.error) {
      return {
        success: false,
        error: result.error,
        correlationId,
      };
    }

    await publish('broker.commission.calculated', {
      correlationId,
      source: 'commission-lifecycle',
      version: '1.0',
      entity: { id: result.data!.id, type: 'commission' },
      payload: {
        commissionId: result.data!.id,
        brokerId: params.broker_id,
        leaseId: params.lease_id,
        totalCommission: calculation.total_commission,
      },
    });

    return {
      success: true,
      data: result.data,
      correlationId,
    };
  }

  async approveCommission(
    commissionId: string,
    approvedBy: string,
    correlationId: string = crypto.randomUUID()
  ): Promise<OperationResult<any>> {
    const result = await commissionService.approve(commissionId, approvedBy);
    if (result.error) {
      return {
        success: false,
        error: result.error,
        correlationId,
      };
    }

    await publish('broker.commission.approved', {
      correlationId,
      source: 'commission-lifecycle',
      version: '1.0',
      entity: { id: result.data!.id, type: 'commission' },
      payload: {
        commissionId: result.data!.id,
        approvedBy,
        amount: result.data!.total_commission,
      },
    });

    return {
      success: true,
      data: result.data,
      correlationId,
    };
  }

  async requestCommissionPayment(
    commissionId: string,
    paymentRequestId: string,
    correlationId: string = crypto.randomUUID()
  ): Promise<OperationResult<any>> {
    const result = await commissionService.requestPayment(commissionId, paymentRequestId);
    if (result.error) {
      return {
        success: false,
        error: result.error,
        correlationId,
      };
    }

    await publish('broker.commission.payment_requested', {
      correlationId,
      source: 'commission-lifecycle',
      version: '1.0',
      entity: { id: result.data!.id, type: 'commission' },
      payload: {
        commissionId: result.data!.id,
        paymentRequestId,
        amount: result.data!.total_commission,
      },
    });

    return {
      success: true,
      data: result.data,
      correlationId,
    };
  }

  async declineCommission(
    commissionId: string,
    reason?: string,
    correlationId: string = crypto.randomUUID()
  ): Promise<OperationResult<any>> {
    const result = await commissionService.decline(commissionId, reason);
    if (result.error) {
      return {
        success: false,
        error: result.error,
        correlationId,
      };
    }

    await publish('broker.commission.declined', {
      correlationId,
      source: 'commission-lifecycle',
      version: '1.0',
      entity: { id: result.data!.id, type: 'commission' },
      payload: {
        commissionId: result.data!.id,
        reason: reason || 'No reason provided',
      },
    });

    return {
      success: true,
      data: result.data,
      correlationId,
    };
  }
}

export const commissionLifecycle = new CommissionLifecycle();
