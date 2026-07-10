// Intent Registry — extensible, no more giant if/else blocks
import { checkPermission } from "./engine";

export type IntentConfig = {
  id: string;
  patterns: RegExp[];
  roles: string[];
  confidence: number;
  requiresClarification?: boolean;
  clarificationQuestion?: string;
  handler: string; // function name as string for dynamic import
};

export type RegisteredIntent = IntentConfig & {
  match: (message: string) => boolean;
};

class IntentRegistry {
  private intents: RegisteredIntent[] = [];

  register(config: IntentConfig) {
    this.intents.push({
      ...config,
      match: (message: string) => config.patterns.some(p => p.test(message)),
    });
  }

  classify(message: string, userRole: string): { intent: RegisteredIntent | null; confidence: number } {
    const msg = message.toLowerCase().trim();
    let bestMatch: RegisteredIntent | null = null;
    let bestConfidence = 0;

    for (const intent of this.intents) {
      if (!checkPermission(userRole, intent.roles[0])) continue;
      if (intent.match(msg) && intent.confidence > bestConfidence) {
        bestMatch = intent;
        bestConfidence = intent.confidence;
      }
    }

    return { intent: bestMatch, confidence: bestConfidence };
  }

  getAll(): RegisteredIntent[] {
    return this.intents;
  }
}

export const intentRegistry = new IntentRegistry();

// Register all intents
intentRegistry.register({ id: "balance_enquiry", patterns: [/balance|what do i owe|how much do i owe|outstanding/i], roles: ["tenant", "property_manager", "finance"], confidence: 97, handler: "handleBalanceEnquiry" });
intentRegistry.register({ id: "statement_request", patterns: [/statement|send statement|get statement/i], roles: ["tenant", "property_manager", "finance"], confidence: 97, handler: "handleStatementRequest" });
intentRegistry.register({ id: "lease_enquiry", patterns: [/lease|expir|when.*lease/i], roles: ["tenant", "property_manager"], confidence: 95, handler: "handleLeaseEnquiry" });
intentRegistry.register({ id: "payment_allocation", patterns: [/payment.*received|did you receive|has.*payment.*allocated/i], roles: ["tenant", "property_manager", "finance"], confidence: 90, handler: "handlePaymentAllocation" });
intentRegistry.register({ id: "next_payment_due", patterns: [/next payment|when.*pay|due date|payment due/i], roles: ["tenant", "property_manager"], confidence: 88, handler: "handleNextPaymentDue" });
intentRegistry.register({ id: "maintenance_request", patterns: [/maintenance|leak|broken|repair|fix|not working|stopped/i], roles: ["tenant", "property_manager"], confidence: 94, requiresClarification: true, clarificationQuestion: "Could you send a photo? It helps assess urgency.", handler: "handleMaintenanceRequest" });
intentRegistry.register({ id: "lease_document", patterns: [/send.*lease|lease.*document|lease.*pdf|copy.*lease/i], roles: ["tenant", "property_manager"], confidence: 92, handler: "handleLeaseDocument" });
intentRegistry.register({ id: "bill_explanation", patterns: [/why.*higher|why.*more|explain.*charge|bill.*higher/i], roles: ["tenant"], confidence: 85, handler: "handleBillExplanation" });
intentRegistry.register({ id: "deposit_enquiry", patterns: [/deposit|deposit amount|deposit held/i], roles: ["tenant", "property_manager"], confidence: 90, handler: "handleDepositEnquiry" });
intentRegistry.register({ id: "renewal_request", patterns: [/renew|renewal|extend.*lease/i], roles: ["tenant", "property_manager"], confidence: 88, handler: "handleRenewalRequest" });
intentRegistry.register({ id: "banking_details", patterns: [/bank.*details|how.*pay|payment.*method|banking/i], roles: ["tenant"], confidence: 92, handler: "handleBankingDetails" });
intentRegistry.register({ id: "office_hours", patterns: [/office hours|open.*when|what time/i], roles: ["tenant"], confidence: 97, handler: "handleOfficeHours" });
intentRegistry.register({ id: "emergency", patterns: [/emergency|urgent|flood|fire|danger/i], roles: ["tenant", "property_manager"], confidence: 100, handler: "handleEmergency" });
intentRegistry.register({ id: "escalation", patterns: [/help|talk.*human|speak.*agent|contact.*manager/i], roles: ["tenant", "property_manager"], confidence: 100, handler: "handleEscalation" });
intentRegistry.register({ id: "portfolio_brief", patterns: [/morning brief|portfolio|what changed|overnight/i], roles: ["property_manager", "finance", "executive"], confidence: 90, handler: "handlePortfolioBrief" });
intentRegistry.register({ id: "expiring_leases", patterns: [/expiring|renewal.*due|leases.*expir/i], roles: ["property_manager", "executive"], confidence: 92, handler: "handleExpiringLeases" });
intentRegistry.register({ id: "occupancy_query", patterns: [/occupancy|vacant|vacancy/i], roles: ["property_manager", "executive"], confidence: 92, handler: "handleOccupancyQuery" });
intentRegistry.register({ id: "arrears_query", patterns: [/arrears|who owes|outstanding.*tenant/i], roles: ["property_manager", "finance", "executive"], confidence: 90, handler: "handleArrearsQuery" });
intentRegistry.register({ id: "revenue_query", patterns: [/revenue|income.*month|billing.*summary/i], roles: ["finance", "executive"], confidence: 88, handler: "handleRevenueQuery" });
intentRegistry.register({ id: "cashbook_query", patterns: [/unallocated|reconcile|bank.*balance/i], roles: ["finance"], confidence: 88, handler: "handleCashbookQuery" });
intentRegistry.register({ id: "confirm_action", patterns: [/^yes$|^yeah$|^sure$|^ok$|^confirm$/i], roles: ["any"], confidence: 98, handler: "handleConfirmAction" });
intentRegistry.register({ id: "maintenance_photo", patterns: [/photo|image|picture|see attached/i], roles: ["tenant"], confidence: 95, handler: "handleMaintenancePhoto" });
