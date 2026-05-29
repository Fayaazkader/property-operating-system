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
  valueColor = "text-white",
}: KpiCardProps) {
  return (
    <div
  className="
    group
    relative
    overflow-hidden
    rounded-3xl
    border
    border-zinc-800
    bg-gradient-to-br
    from-zinc-950
    to-black
    p-6
    transition-all
    duration-300
    hover:border-zinc-700
    hover:shadow-[0_0_30px_rgba(255,255,255,0.03)]
  "
>

      <div className="flex items-start justify-between mb-4">

        <p className="
  text-xs
  uppercase
  tracking-[0.25em]
  text-zinc-500
">
          {title}
        </p>

        {status && (
          <span className="
  rounded-full
  border
  border-zinc-800
  bg-zinc-900
  px-3
  py-1
  text-[10px]
  font-bold
  uppercase
  tracking-[0.2em]
  text-zinc-400
">
            {status}
          </span>
        )}

      </div>

      <h2 className={`
  mt-6
  text-5xl
  font-black
  tracking-tight
  ${valueColor}
`}>
        {value}
      </h2>

      {trend && (
        <p className="
  mt-4
  text-sm
  leading-6
  text-zinc-400
">
          {trend}
        </p>
      )}

    </div>
  )
}