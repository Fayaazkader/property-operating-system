# ADR-003: Audit Requirements

**Status:** Adopted  
**Date:** 2026-07-26

## Decision

- Every mutation logs: actor, timestamp, action, resource, old/new values
- Audit logs are immutable
- Financial transactions require correlation IDs

## Rationale

Enterprise customers require full audit trails for compliance. Immutable audit logs protect against tampering.

## Alternatives Considered

- **Audit only financial transactions**: Insufficient for operational compliance
- **Soft audit (mutable logs)**: Not acceptable for enterprise
