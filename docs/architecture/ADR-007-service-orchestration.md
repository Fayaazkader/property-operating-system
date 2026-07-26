# ADR-007: Business Services Own Workflow

**Status:** Adopted  
**Date:** 2026-07-26

## Decision

No React component, API route, or server action may implement business workflow directly. All business workflow must execute through a Service.

## Rationale

Services are the single source of truth for business rules. UI, API routes, and background jobs all call the same services, ensuring consistent behavior regardless of how a workflow is triggered.

## Alternatives Considered

- **Workflow in API routes**: Duplicates logic across routes
- **Workflow in UI components**: Cannot be reused, hard to test
