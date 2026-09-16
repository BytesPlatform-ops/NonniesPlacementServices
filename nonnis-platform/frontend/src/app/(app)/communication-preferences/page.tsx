import { Suspense } from "react";
import { CommunicationPreferencesView } from "@/features/communications/CommunicationPreferencesView";

export default function SeekerCommunicationPreferencesPage() {
  return (
    <Suspense fallback={null}>
      <CommunicationPreferencesView />
    </Suspense>
  );
}
