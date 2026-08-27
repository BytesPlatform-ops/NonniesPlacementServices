"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet } from "@/lib/api-client";
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
        } catch {
          /* surfaced elsewhere */
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
  }, [loadMe]);

  const switchOrganization = useCallback(
    async (id: string) => {
      persistActiveOrg(id);
      setActiveOrganizationId(id);
      await loadMe();
    },
    [loadMe],
  );

  const signOut = useCallback(async () => {
    await supabaseBrowser().auth.signOut();
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
