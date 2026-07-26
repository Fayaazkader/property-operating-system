# Lease Module

## Responsibilities
- Lease lifecycle management (create, activate, update, archive)
- Lease queries (by tenant, property, entity, status, expiry)
- Archive governance

## Public Service Methods
| Method | Description |
|--------|-------------|
| `list()` | All leases |
| `get(id)` | Single lease by UUID |
| `getByCode(code)` | Single lease by business code (LSE-000001) |
| `getByTenant(tenantId)` | Leases for a tenant |
| `getByProperty(propertyId)` | Leases for a property |
| `getExpiring(days)` | Leases expiring within N days |
| `activate(intakeId)` | Activate lease from intake (atomic RPC) |
| `update(id, data)` | Update lease fields |
| `archive(id)` | Archive with governance checks |

## Owned Tables
- `leases`
- `lease_timeline`

## Published Events
- `lease.activated` — after successful atomic activation
- `lease.archived` — after successful archive

## RPCs
- `activate_lease_rpc(p_intake_id, p_initiated_by)` — atomic activation
- `next_business_code(seq_name)` — shared sequence generator

## Validation Strategy
- **Service layer (leaseValidators):** Primary user-facing validation
- **RPC layer:** Database safety checks only — catches edge cases, never duplicates service logic
- **Database constraints:** Final safety net (NOT NULL, CHECK, UNIQUE)
