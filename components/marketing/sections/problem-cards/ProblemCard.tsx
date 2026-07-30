export function ProblemCard({ children, style }: { children: React.ReactNode; style: React.CSSProperties }) {
  return (
    <div
      className="absolute animate-float rounded-xl border border-white/[0.1] bg-white/[0.04] backdrop-blur-sm p-5 shadow-lg shadow-black/30"
      style={style}
    >
      {children}
    </div>
  );
}
