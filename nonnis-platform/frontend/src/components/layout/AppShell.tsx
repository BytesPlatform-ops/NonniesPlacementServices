import type { ReactNode } from "react";
import { UnreadMessagesProvider } from "@/providers/unread-messages-provider";
import { NotificationsProvider } from "@/providers/notifications-provider";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

/** Application chrome: persistent sidebar + top bar around routed content. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    // Scoped to the signed-in shell so the unread poll only runs for someone who
    // can actually read the inbox, and stops the moment they sign out.
    <UnreadMessagesProvider>
      {/* One notification state for the whole shell: the bell in the top bar
          and the sidebar badge both read it, so they cannot disagree. */}
      <NotificationsProvider>
        {/*
          `h-screen overflow-hidden` is the whole fix: the document itself no
          longer scrolls, so nothing can carry the sidebar out of view or reset
          it on a route change. The two columns own their own scrolling — the
          navigation inside the sidebar, and the main region here.
        */}
        <div className="flex h-screen overflow-hidden bg-porcelain text-ink">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <TopBar />
            <main className="min-h-0 flex-1 overflow-y-auto">
              <div className="mx-auto w-full max-w-7xl px-5 py-6 sm:px-8">{children}</div>
            </main>
          </div>
        </div>
      </NotificationsProvider>
    </UnreadMessagesProvider>
  );
}
