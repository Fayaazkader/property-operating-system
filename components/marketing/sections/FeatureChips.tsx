export function FeatureChips({ items }: { items: string[] }) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {items.map((item) => (
        <span key={item} className="text-[10px] px-3 py-1 rounded-full border border-white/[0.06] text-zinc-400">
          {item}
        </span>
      ))}
    </div>
  );
}
