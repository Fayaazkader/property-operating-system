interface StatusBadgeProps {
  status: string
}

export default function StatusBadge({
  status,
}: StatusBadgeProps) {

  function getStyles() {

    switch (status.toLowerCase()) {

      case "critical":
        return "bg-red-500/10 text-red-600 border-red-200";

      case "high":
        return "bg-orange-500/10 text-orange-600 border-orange-200";

      case "medium":
        return "bg-yellow-500/10 text-yellow-700 border-yellow-200";

      case "low":
        return "bg-green-500/10 text-green-700 border-green-200";

      case "completed":
        return "bg-green-500/10 text-green-700 border-green-200";

      case "active":
        return "bg-blue-500/10 text-blue-700 border-blue-200";

      case "moderate":
        return "bg-orange-500/10 text-orange-600 border-orange-200";

      case "stable":
        return "bg-green-500/10 text-green-700 border-green-200";

      default:
        return "bg-zinc-500/10 text-zinc-700 border-zinc-200";
    }
  }

  return (

    <span
      className={`
        inline-flex
        items-center
        rounded-full
        border
        px-3
        py-1
        text-xs
        font-bold
        uppercase
        tracking-[0.15em]

        ${getStyles()}
      `}
    >
      {status}
    </span>
  )
}