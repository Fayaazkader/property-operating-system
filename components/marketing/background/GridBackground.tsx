export function GridBackground() {
  return (
    <div
      className="fixed inset-0 pointer-events-none"
      style={{
        backgroundImage: `linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
                          linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)`,
        backgroundSize: '80px 80px',
        maskImage: 'radial-gradient(ellipse 60% 60% at 50% 0%, black 40%, transparent 80%)',
        WebkitMaskImage: 'radial-gradient(ellipse 60% 60% at 50% 0%, black 40%, transparent 80%)',
      }}
    />
  );
}
