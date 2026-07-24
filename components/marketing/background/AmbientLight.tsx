export function AmbientLight() {
  return (
    <>
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-gradient-to-b from-amber-500/[0.03] via-transparent to-transparent rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-0 left-1/4 w-[600px] h-[400px] bg-gradient-to-t from-amber-500/[0.02] via-transparent to-transparent rounded-full blur-[100px] pointer-events-none" />
    </>
  );
}
