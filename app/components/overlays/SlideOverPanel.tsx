interface SlideOverPanelProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

export default function SlideOverPanel({
  open,
  onClose,
  title,
  children,
}: SlideOverPanelProps) {

  if (!open) return null;

  return (

    <div className="fixed inset-0 z-50 flex justify-end">

      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative h-full w-full max-w-2xl bg-white shadow-2xl overflow-y-auto">

        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white px-8 py-6">

          <h2 className="text-2xl font-bold text-black">
            {title}
          </h2>

          <button
            onClick={onClose}
            className="
              rounded-xl
              border
              border-zinc-200
              px-4
              py-2
              text-sm
              font-medium
              transition
              hover:bg-zinc-100
            "
          >
            Close
          </button>

        </div>

        <div className="p-8">

          {children}

        </div>

      </div>

    </div>
  )
}