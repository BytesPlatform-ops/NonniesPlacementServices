"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { landingPath } from "@/lib/landing";
import { getSeekerCommunicationPreferences } from "@/services/seeker.service";

/** Role-aware post-login dispatcher: sends provider users to the portal. */
export default function HomeDispatcher() {
  const router = useRouter();
  const { loading, me } = useAuth();

  useEffect(() => {
    if (loading) return;
    const destination = landingPath(me);

    // A family member who has never given a number is sent through the contact
    // step once, immediately after finishing their account setup. It is asked,
    // never enforced: the step itself offers "Skip for now", and anyone who has
    // already given a number goes straight to their portal. A failure here must
    // never strand someone on a spinner, so it falls through to the portal.
    if (destination === "/seeker") {
      void getSeekerCommunicationPreferences()
        .then((prefs) => router.replace(prefs.phone ? destination : "/seeker/communication-preferences?onboarding=1"))
        .catch(() => router.replace(destination));
      return;
    }

    router.replace(destination);
  }, [loading, me, router]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center text-slate-500">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
    </div>
  );
}
