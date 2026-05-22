interface ToolbarProps {
  children: React.ReactNode
}

export default function Toolbar({
  children,
}: ToolbarProps) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white border border-zinc-200 rounded-2xl p-4 shadow-sm">
      {children}
    </div>
  )
}