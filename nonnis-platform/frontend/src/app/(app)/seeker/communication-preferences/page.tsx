import { Suspense } from "react";
import { CommunicationPreferencesView } from "@/features/communications/CommunicationPreferencesView";

/**
 * The family portal's copy of the shared preferences screen.
 *
 * Two routes render one component so each portal keeps its own URL space — a
 * family member never follows a link out of /seeker, and staff never follow one
 * into it. The API behind both is the same caller's-own-row endpoint.
 */
export default function SeekerCommunicationPreferencesPage() {
  return (
    <Suspense fallback={null}>
      <CommunicationPreferencesView />
    </Suspense>
  );
}
