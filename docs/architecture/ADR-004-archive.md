# ADR-004: Soft Delete & Archive

**Owners:** AssetFlow Platform
**Supersedes:** None
**Superseded by:** None**Status:** Adopted  
**Date:** 2026-07-26

## Decision

- No hard deletes on business records
- Archive semantics are domain-specific
- Each domain repository owns its archive implementation

## Rationale

Hard deletes break audit trails and referential integrity. Different domains have different archive requirements (Entity: is_archived, Property: property_status, Lease: lease_status).

## Alternatives Considered

- **Generic archive in BaseRepository**: Too rigid for domain-specific needs
- **Hard deletes with audit log**: Loses referential integrity
