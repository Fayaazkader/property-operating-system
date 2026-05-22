export default function SearchInput() {
  return (
    <div className="w-full lg:max-w-sm">

      <input
        type="text"
        placeholder="Search portfolio..."
        className="
          w-full
          rounded-xl
          border
          border-zinc-200
          bg-zinc-50
          px-4
          py-3
          text-sm
          outline-none
          transition
          focus:border-black
          focus:bg-white
        "
      />

    </div>
  )
}