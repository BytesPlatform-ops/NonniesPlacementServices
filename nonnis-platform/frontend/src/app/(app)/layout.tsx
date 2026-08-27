import { AuthProvider } from "@/providers/auth-provider";
import { ProtectedShell } from "@/components/layout/ProtectedShell";

export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ProtectedShell>{children}</ProtectedShell>
    </AuthProvider>
  );
}
