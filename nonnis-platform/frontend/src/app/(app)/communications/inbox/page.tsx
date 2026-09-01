import { Suspense } from "react";
import { InboxView } from "@/features/communications/inbox/InboxView";

export default function InboxPage() {
  return (
    <Suspense fallback={null}>
      <InboxView />
    </Suspense>
  );
}
