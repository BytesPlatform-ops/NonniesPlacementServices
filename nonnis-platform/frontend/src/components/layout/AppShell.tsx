import type { ReactNode } from "react";
import { UnreadMessagesProvider } from "@/providers/unread-messages-provider";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

/** Application chrome: persistent sidebar + top bar around routed content. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    // Scoped to the signed-in shell so the unread poll only runs for someone who
    // can actually read the inbox, and stops the moment they sign out.
    <UnreadMessagesProvider>
      <div className="flex min-h-screen bg-porcelain text-ink">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-6 sm:px-8">{children}</main>
        </div>
      </div>
    </UnreadMessagesProvider>
  );
}
