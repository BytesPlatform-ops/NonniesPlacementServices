"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useAsync } from "@/hooks/use-async";
import { useAuth } from "@/providers/auth-provider";
import { PERMISSIONS } from "@/lib/permissions";
import { getProviderPortalMe } from "@/services/provider-portal.service";
import type { ProviderDetailView } from "@/types/providers";
import type { ProviderPortalMe } from "@/types/provider-portal";
import { Panel } from "@/components/ui/Panel";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";

interface PortalContextValue {
  loading: boolean;
  error: Error | null;
  data: ProviderPortalMe | null;
  reload: () => void;
  canManageProfile: boolean;
}

const PortalContext = createContext<PortalContextValue | null>(null);

export function ProviderPortalProvider({ children }: { children: ReactNode }) {
  const { activeOrganizationId, hasPermission } = useAuth();
  const { data, loading, error, reload } = useAsync(() => getProviderPortalMe(), [activeOrganizationId]);

  const value = useMemo<PortalContextValue>(
    () => ({ loading, error, data, reload, canManageProfile: hasPermission(PERMISSIONS.PROVIDERS_MANAGE_OWN) }),
    [loading, error, data, reload, hasPermission],
  );

  return <PortalContext.Provider value={value}>{children}</PortalContext.Provider>;
}

export function usePortal(): PortalContextValue {
  const ctx = useContext(PortalContext);
  if (!ctx) throw new Error("usePortal must be used within a ProviderPortalProvider.");
  return ctx;
}

/**
 * Renders the shared loading / error / no-provider states, and otherwise hands
 * the resolved provider (and a reload) to the page. Keeps every portal page
 * consistent without repeating the guard logic.
 */
export function PortalContent({
  children,
}: {
  children: (provider: ProviderDetailView, reload: () => void) => ReactNode;
}) {
  const { loading, error, data, reload } = usePortal();
  if (loading) return <LoadingState label="Loading your provider…" />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (!data || !data.hasProvider || !data.provider) {
    return (
      <Panel>
        <EmptyState
          title="No provider profile"
          message="Your active organization isn't set up as a provider yet. Please contact Nonnis to have a provider profile created."
        />
      </Panel>
    );
  }
  return <>{children(data.provider, reload)}</>;
}
