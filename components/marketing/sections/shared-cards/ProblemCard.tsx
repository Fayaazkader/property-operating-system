import type { CSSProperties, ReactNode } from "react";

export function ProblemCard({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`rounded-xl border border-white/[0.1] bg-white/[0.04] backdrop-blur-sm p-5 shadow-lg shadow-black/30 ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}
