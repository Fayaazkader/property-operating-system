export default function SecurityPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20 text-white">
      <h1 className="text-3xl font-bold">Security</h1>
      <div className="mt-8 space-y-6 text-gray-400">
        <div>
          <h2 className="text-lg font-semibold text-white">Data Isolation</h2>
          <p className="mt-1">Row-Level Security (RLS) ensures every entity's data is completely isolated. Users only see what they're authorized to see.</p>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Access Control</h2>
          <p className="mt-1">Role-based access control (RBAC) with platform admins, entity admins, finance, property managers, and read-only roles.</p>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Audit Trail</h2>
          <p className="mt-1">Every action is logged. Every mutation is tracked. Nothing is ever deleted — records are archived through governed lifecycle states.</p>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Encryption</h2>
          <p className="mt-1">All data is encrypted at rest and in transit. Database backups are automated and encrypted.</p>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">POPIA Compliance</h2>
          <p className="mt-1">Built with South African data protection requirements in mind. Tenant data is protected and access is controlled.</p>
        </div>
      </div>
    </div>
  );
}
