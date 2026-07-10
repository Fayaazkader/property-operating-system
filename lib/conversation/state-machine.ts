// Conversation State Machine — tracks where user is in a workflow

export type ConversationState = 
  | "idle"
  | "awaiting_clarification"
  | "maintenance_waiting_photo"
  | "maintenance_waiting_confirmation"
  | "renewal_waiting_confirmation"
  | "awaiting_human";

export type StateTransition = {
  from: ConversationState;
  to: ConversationState;
  onIntent: string;
  condition?: (context: any) => boolean;
};

const transitions: StateTransition[] = [
  { from: "idle", to: "maintenance_waiting_photo", onIntent: "maintenance_request" },
  { from: "maintenance_waiting_photo", to: "maintenance_waiting_confirmation", onIntent: "maintenance_photo" },
  { from: "maintenance_waiting_confirmation", to: "idle", onIntent: "confirm_action" },
  { from: "idle", to: "renewal_waiting_confirmation", onIntent: "renewal_request" },
  { from: "renewal_waiting_confirmation", to: "idle", onIntent: "confirm_action" },
  { from: "idle", to: "awaiting_human", onIntent: "escalation" },
  { from: "awaiting_human", to: "idle", onIntent: "confirm_action" },
  { from: "idle", to: "awaiting_clarification", onIntent: "balance_enquiry", condition: (ctx) => ctx?.previousIntents?.includes("balance_enquiry") },
];

export function transitionState(current: ConversationState, intent: string, context?: any): ConversationState {
  for (const t of transitions) {
    if (t.from === current && t.onIntent === intent) {
      if (t.condition && !t.condition(context)) continue;
      return t.to;
    }
  }
  return current === "idle" ? "idle" : current;
}

export function getStatePrompt(state: ConversationState): string {
  switch (state) {
    case "maintenance_waiting_photo": return "Please send a photo of the issue when you're ready.";
    case "maintenance_waiting_confirmation": return "Would you like me to log this maintenance request?";
    case "renewal_waiting_confirmation": return "Would you like me to notify your property manager to start the renewal process?";
    case "awaiting_human": return "A property manager will be with you shortly.";
    case "awaiting_clarification": return "Could you clarify what you'd like to know?";
    default: return "";
  }
}
