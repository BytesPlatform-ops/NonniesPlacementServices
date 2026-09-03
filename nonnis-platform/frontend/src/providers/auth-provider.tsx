"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiGet } from "@/lib/api-client";
import { getActiveOrg, setActiveOrg as persistActiveOrg } from "@/lib/active-org";
import { resolveActiveOrg } from "@/lib/resolve-active-org";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { MeResponse } from "@/types/auth";

interface AuthContextValue {
  loading: boolean;
  me: MeResponse | null;
  activeOrganizationId: string | null;
  permissions: string[];
  hasPermission: (code: string) => boolean;
  switchOrganization: (id: string) => Promise<void>;
  reload: () => Promise<void>;
  signOut: () => Promise<void>;
}

/**
 * Drop the stored Supabase session. Attempts a server-side revoke first, then
 * always falls back to a local-only sign-out so browser storage is cleared even
 * when the token is already invalid, the network is down, or the call throws.
 */
async function discardSession(supabase: ReturnType<typeof supabaseBrowser>): Promise<void> {
  try {
    const { error } = await supabase.auth.signOut();
    if (!error) return;
  } catch {
    // fall through to the local clear below
  }
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // Storage is already gone or unavailable — nothing further to clean up.
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [activeOrganizationId, setActiveOrganizationId] = useState<string | null>(getActiveOrg());

  const loadMe = useCallback(async () => {
    let data = await apiGet<MeResponse>("/api/v1/auth/me");
    if (data.provisioned && data.memberships.length > 0) {
      const chosen = resolveActiveOrg(
        getActiveOrg(),
        data.activeOrganizationId,
        data.memberships.map((m) => m.organizationId),
      );
      if (chosen && getActiveOrg() !== chosen) {
        persistActiveOrg(chosen);
        data = await apiGet<MeResponse>("/api/v1/auth/me");
      }
      setActiveOrganizationId(chosen);
    } else {
      persistActiveOrg(null);
      setActiveOrganizationId(null);
    }
    setMe(data);
  }, []);

  useEffect(() => {
    const supabase = supabaseBrowser();
    let mounted = true;

    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (data.session) {
        try {
          await loadMe();
        } catch (err) {
          // A stored session that the API rejects is dead: the token expired, or
          // it belongs to an identity the backend can no longer resolve. Clearing
          // it and sending the user to sign in is the only recovery. Without
          // this the shell renders "No organization access", which misdescribes
          // an expired session as a missing membership.
          if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
            await discardSession(supabase);
            if (!mounted) return;
            setMe(null);
            persistActiveOrg(null);
            setActiveOrganizationId(null);
            setLoading(false);
            router.replace("/login");
            return;
          }
        }
      }
      setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        setMe(null);
        persistActiveOrg(null);
        setActiveOrganizationId(null);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadMe, router]);

  const switchOrganization = useCallback(
    async (id: string) => {
      persistActiveOrg(id);
      setActiveOrganizationId(id);
      await loadMe();
    },
    [loadMe],
  );

  const signOut = useCallback(async () => {
    // Revoking the token server-side is best effort. It is a network call made
    // with the very credential that may already be rejected, so it must never
    // be able to block the local sign-out — otherwise the one escape hatch on
    // the "no access" screen is the one thing a broken session prevents.
    await discardSession(supabaseBrowser());
    setMe(null);
    persistActiveOrg(null);
    setActiveOrganizationId(null);
    router.replace("/login");
  }, [router]);

  const value = useMemo<AuthContextValue>(() => {
    const permissions = me?.permissions ?? [];
    return {
      loading,
      me,
      activeOrganizationId,
      permissions,
      hasPermission: (code: string) => permissions.includes(code),
      switchOrganization,
      reload: loadMe,
      signOut,
    };
  }, [loading, me, activeOrganizationId, switchOrganization, loadMe, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }
  return ctx;
}
