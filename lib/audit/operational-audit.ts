import {
  OperationalAuditEvent,
} from "@/app/types/finance";

export const operationalAuditEvents:
  OperationalAuditEvent[] =
  [];
  export function logOperationalEvent(
  event: OperationalAuditEvent
) {

  operationalAuditEvents.unshift(
    event
  );
}