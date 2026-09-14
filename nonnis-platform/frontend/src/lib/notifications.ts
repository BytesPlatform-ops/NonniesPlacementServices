import type { NotificationPriority } from "@/types/notifications";

/**
 * Priority is shown, not shouted.
 *
 * Only HIGH and CRITICAL earn a coloured label; NORMAL and LOW would turn a
 * list into a wall of badges and stop the urgent ones registering at all.
 */
export const PRIORITY_LABELS: Record<NotificationPriority, string> = {
  LOW: "Low",
  NORMAL: "Normal",
  HIGH: "High",
  CRITICAL: "Critical",
};

export function priorityClasses(priority: NotificationPriority): string | null {
  switch (priority) {
    case "CRITICAL":
      return "bg-rose-100 text-rose-800";
    case "HIGH":
      return "bg-amber-100 text-amber-800";
    default:
      return null;
  }
}

/** "5 min ago" — short enough for a dropdown row. */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const seconds = Math.max(0, Math.round((now.getTime() - then) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString();
}
