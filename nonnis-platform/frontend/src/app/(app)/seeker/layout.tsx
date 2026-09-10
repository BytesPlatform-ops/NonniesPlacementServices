"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { isCareSeeker, landingPath } from "@/lib/landing";

/**
 * Route guard for the family portal.
 *
 * A convenience, not the security boundary: every `/api/v1/seeker/*` route is
 * gated on a `seeker_*` permission and then on a case grant, so a staff or
 * provider session that reached these pages would still be served nothing.
 * This just sends them where they belong instead of showing empty panels.
 */
export default function SeekerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { loading, me } = useAuth();
  const allowed = isCareSeeker(me);

  useEffect(() => {
    if (!loading && me && !allowed) router.replace(landingPath(me));
  }, [loading, me, allowed, router]);

  if (loading || !allowed) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      </div>
    );
  }

  return <>{children}</>;
}
