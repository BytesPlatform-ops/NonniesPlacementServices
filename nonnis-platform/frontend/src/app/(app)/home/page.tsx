"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { landingPath } from "@/lib/landing";

/** Role-aware post-login dispatcher: sends provider users to the portal. */
export default function HomeDispatcher() {
  const router = useRouter();
  const { loading, me } = useAuth();

  useEffect(() => {
    if (!loading) router.replace(landingPath(me));
  }, [loading, me, router]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center text-slate-500">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
    </div>
  );
}
