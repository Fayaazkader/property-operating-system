# AssetFlow Platform Rules

## Rule 001 — Domain Module Architecture

Every business domain module must follow this structure:


### Responsibilities

| Layer | Role | Must NOT |
|-------|------|----------|
| **Repository** | Data access | Business logic, validation |
| **Service** | Business rules, orchestration | Direct Supabase calls, UI state |
| **UI** | Presentation, user interaction | Business logic, direct Supabase calls |

### BaseRepository

All repositories extend `lib/platform/shared/base-repository.ts` which provides:

- `findAll()` — list all records
- `findById(id)` — single record
- `create(data)` — insert
- `update(id, data)` — update
- `archive(id)` — soft archive
- `countRelated(table, foreignKey, id, filters?)` — count related records

### Consistency

This pattern applies to: Entity, Property, Premises, Tenant, Lease, Supplier, Broker, and all future domain modules.
