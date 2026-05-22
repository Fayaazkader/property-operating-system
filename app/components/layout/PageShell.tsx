export default function PageShell({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-zinc-100 space-y-6 p-6">
      {children}
    </div>
  )
}