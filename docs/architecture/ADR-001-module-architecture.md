# ADR-001: Domain Module Architecture

**Status:** Adopted  
**Date:** 2026-07-26

## Decision

Every business domain module follows a consistent structure:


## Rationale

- Prevents business logic from drifting into React components
- Makes modules independently testable
- Consistent pattern reduces cognitive overhead
- BaseRepository<T> provides standard CRUD without duplication

## Alternatives Considered

- **Flat files in lib/**: Harder to maintain as modules grow
- **All logic in UI components**: Violates separation of concerns, untestable
