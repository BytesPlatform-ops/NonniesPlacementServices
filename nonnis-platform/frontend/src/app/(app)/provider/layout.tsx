import { ProviderPortalProvider } from "@/features/provider-portal/portal-context";

export default function ProviderPortalLayout({ children }: { children: React.ReactNode }) {
  return <ProviderPortalProvider>{children}</ProviderPortalProvider>;
}
