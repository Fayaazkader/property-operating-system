interface ToolbarButtonProps {
  label: string
}

export default function ToolbarButton({
  label,
}: ToolbarButtonProps) {
  return (
    <button
      className="
        rounded-xl
        border
        border-zinc-200
        bg-white
        px-4
        py-3
        text-sm
        font-medium
        transition
        hover:bg-zinc-100
      "
    >
      {label}
    </button>
  )
}