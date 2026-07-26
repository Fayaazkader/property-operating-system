# AssetFlow Platform Rules

## Rule 001 — Domain Module Architecture

Every business domain module follows:


### Layer Responsibilities

| Layer | Role | Must NOT |
|-------|------|----------|
| Repository | Data access only | Business logic, validation |
| Service | Business rules, orchestration | Direct Supabase calls, UI state |
| UI | Presentation | Business logic, direct Supabase calls |

---

## Rule 002 — Multi-tenancy & Entity Boundaries

- Every business table must include `entity_id`
- RLS policies must scope to `auth_entities()`
- Users belong to entities via `user_entity_access`
- Cross-entity data access is prohibited by default

---

## Rule 003 — Audit Requirements

- Every mutation logs: actor, timestamp, action, resource, old/new values
- Audit logs are immutable
- Financial transactions require correlation IDs

---

## Rule 004 — Soft Delete & Archive

- No hard deletes on business records
- Archive semantics are domain-specific:
  - Entity: `is_archived = true, is_active = false`
  - Property: `property_status = 'Archived'`
  - Lease: `lease_status = 'Terminated'`
  - Each domain repository owns its archive implementation

---

## Rule 005 — Permission & RBAC

- All actions check permissions via `rbacManager.hasPermission()`
- Roles are collections of permissions
- Platform Super Admin is separate from Company Admin

---

## Rule 006 — Domain Events

- Significant business events publish to the Event Bus
- Events carry: correlationId, source, version, payload
- Downstream services subscribe, never directly couple
