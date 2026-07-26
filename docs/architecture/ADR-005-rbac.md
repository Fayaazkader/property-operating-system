# ADR-005: Permission & RBAC

**Owners:** AssetFlow Platform
**Supersedes:** None
**Superseded by:** None**Status:** Adopted  
**Date:** 2026-07-26

## Decision

- All actions check permissions via `rbacManager.hasPermission()`
- Roles are collections of permissions
- Platform Super Admin is separate from Company Admin

## Rationale

Role-based access control enables granular security. Separating platform-level from company-level administration prevents privilege escalation.

## Alternatives Considered

- **Simple role check (admin/user)**: Not granular enough for enterprise
- **Permissions only (no roles)**: Harder to manage at scale
