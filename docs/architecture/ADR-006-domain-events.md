# ADR-006: Domain Events

**Status:** Adopted  
**Date:** 2026-07-26

## Decision

- Significant business events publish to the Event Bus
- Events carry: correlationId, source, version, payload
- Downstream services subscribe, never directly couple

## Rationale

Event-driven architecture enables loose coupling between modules. When a lease is activated, Revenue, Notifications, and Reporting all react without Lease knowing about them.

## Alternatives Considered

- **Direct service calls**: Creates tight coupling
- **Database triggers**: Hidden logic, hard to debug
