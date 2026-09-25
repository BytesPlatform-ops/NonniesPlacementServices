import { Suspense } from "react";
import { SeekerOrdersView } from "@/features/marketplace/SeekerOrdersView";

export default function SeekerOrdersPage() {
  // Suspense because the view reads ?payment= to report the outcome of a return
  // from Stripe Checkout.
  return (
    <Suspense fallback={null}>
      <SeekerOrdersView />
    </Suspense>
  );
}
