// Public layout - just renders children
// The RouteGuard in the root layout handles hiding the sidebar
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
