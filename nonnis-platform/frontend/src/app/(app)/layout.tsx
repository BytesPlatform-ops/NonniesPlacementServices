import { AuthProvider } from "@/providers/auth-provider";
import { ToastProvider } from "@/providers/toast-provider";
import { ConfirmProvider } from "@/providers/confirm-provider";
import { ProtectedShell } from "@/components/layout/ProtectedShell";

export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <ConfirmProvider>
          <ProtectedShell>{children}</ProtectedShell>
        </ConfirmProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
