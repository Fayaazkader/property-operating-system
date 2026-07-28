import { PlatformProvider } from "../context/PlatformContext";
import RouteGuard from "../components/RouteGuard";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <PlatformProvider>
      <RouteGuard>{children}</RouteGuard>
    </PlatformProvider>
  );
}
