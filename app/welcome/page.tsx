import { Suspense } from "react";
import WelcomeClient from "./WelcomeClient";

export default function WelcomePage() {
  return (
    <Suspense fallback={null}>
      <WelcomeClient />
    </Suspense>
  );
}
