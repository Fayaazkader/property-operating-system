export function ProblemCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-white/[0.1] bg-white/[0.04] backdrop-blur-sm p-5 shadow-lg shadow-black/30 ${className}`}>
      {children}
    </div>
  );
}
