# ADR-002: Multi-tenancy & Entity Boundaries

**Owners:** AssetFlow Platform
**Supersedes:** None
**Superseded by:** None**Status:** Adopted  
**Date:** 2026-07-26

## Decision

- Every business table includes `entity_id`
- RLS policies scope to `auth_entities()`
- Users belong to entities via `user_entity_access`
- Cross-entity data access is prohibited by default

## Rationale

AssetFlow is a multi-tenant SaaS platform. Entity is the security boundary. Data isolation must be enforced at the database level (RLS), not just the application level.

## Alternatives Considered

- **Application-level filtering only**: Vulnerable to bugs, not secure
- **Separate databases per tenant**: Overhead for early stage, consider later
