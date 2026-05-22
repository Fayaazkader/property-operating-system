interface KpiCardProps {
  title: string
  value: string | number
  status?: string
  trend?: string
  valueColor?: string
}

export default function KpiCard({
  title,
  value,
  status,
  trend,
  valueColor = "text-black",
}: KpiCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6">

      <div className="flex items-start justify-between mb-4">

        <p className="text-sm font-medium text-zinc-500">
          {title}
        </p>

        {status && (
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
            {status}
          </span>
        )}

      </div>

      <h2 className={`text-4xl font-bold ${valueColor}`}>
        {value}
      </h2>

      {trend && (
        <p className="mt-3 text-sm text-zinc-500">
          {trend}
        </p>
      )}

    </div>
  )
}