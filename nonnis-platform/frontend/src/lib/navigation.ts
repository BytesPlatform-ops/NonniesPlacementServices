import { PERMISSIONS } from "./permissions";

export interface NavItem {
  label: string;
  href: string;
  permission: string;
}

export interface NavGroup {
  title: string | null;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    title: null,
    items: [
      { label: "Operations", href: "/operations", permission: PERMISSIONS.CASES_READ_ALL },
      { label: "Form Submissions", href: "/operations/form-submissions", permission: PERMISSIONS.FORM_SUBMISSIONS_READ },
      { label: "Dashboard", href: "/dashboard", permission: PERMISSIONS.CASES_READ },
      { label: "Cases", href: "/cases", permission: PERMISSIONS.CASES_READ },
      { label: "Tasks", href: "/tasks", permission: PERMISSIONS.TASKS_READ },
      { label: "Providers", href: "/providers", permission: PERMISSIONS.PROVIDERS_READ },
    ],
  },
  {
    title: "Reports",
    items: [{ label: "Reports", href: "/reports", permission: PERMISSIONS.REPORTS_READ }],
  },
  {
    title: "Communications",
    items: [
      { label: "Inbox", href: "/communications/inbox", permission: PERMISSIONS.COMMUNICATIONS_READ },
      { label: "Contacts", href: "/communications/contacts", permission: PERMISSIONS.COMMUNICATIONS_READ },
      { label: "Lists", href: "/communications/lists", permission: PERMISSIONS.COMMUNICATIONS_READ },
      { label: "Email Templates", href: "/communications/email-templates", permission: PERMISSIONS.COMMUNICATIONS_READ },
      { label: "Email Campaigns", href: "/communications/email-campaigns", permission: PERMISSIONS.COMMUNICATIONS_READ },
      { label: "Imports", href: "/communications/imports", permission: PERMISSIONS.COMMUNICATIONS_IMPORT },
    ],
  },
  {
    title: "Content",
    items: [
      { label: "Blog", href: "/content/blog", permission: PERMISSIONS.CONTENT_READ },
      { label: "Short Videos", href: "/content/videos", permission: PERMISSIONS.CONTENT_READ },
      { label: "Testimonials", href: "/content/testimonials", permission: PERMISSIONS.CONTENT_READ },
    ],
  },
  {
    title: "Administration",
    items: [
      { label: "Organizations", href: "/admin/organizations", permission: PERMISSIONS.ORGANIZATIONS_MANAGE },
      { label: "Users", href: "/admin/users", permission: PERMISSIONS.USERS_READ },
      { label: "Facilities", href: "/admin/facilities", permission: PERMISSIONS.FACILITIES_READ },
      { label: "Service Categories", href: "/admin/service-categories", permission: PERMISSIONS.SERVICE_CATEGORIES_MANAGE },
    ],
  },
];

/** Provider self-service portal navigation (shown when the active org is a provider). */
const PROVIDER_NAV: NavGroup[] = [
  {
    title: null,
    items: [
      { label: "Overview", href: "/provider", permission: PERMISSIONS.PROVIDERS_READ },
      { label: "Referrals", href: "/provider/referrals", permission: PERMISSIONS.REFERRALS_READ },
      { label: "Profile", href: "/provider/profile", permission: PERMISSIONS.PROVIDERS_READ },
      { label: "Services", href: "/provider/services", permission: PERMISSIONS.PROVIDERS_READ },
      { label: "Coverage", href: "/provider/coverage", permission: PERMISSIONS.PROVIDERS_READ },
      { label: "Payment / Insurance", href: "/provider/payment", permission: PERMISSIONS.PROVIDERS_READ },
      { label: "Languages", href: "/provider/languages", permission: PERMISSIONS.PROVIDERS_READ },
      { label: "Hours", href: "/provider/hours", permission: PERMISSIONS.PROVIDERS_READ },
      { label: "Capacity", href: "/provider/capacity", permission: PERMISSIONS.PROVIDERS_READ },
      { label: "Team", href: "/provider/team", permission: PERMISSIONS.USERS_READ },
    ],
  },
];

function filterNav(groups: NavGroup[], permissions: readonly string[]): NavGroup[] {
  const granted = new Set(permissions);
  return groups
    .map((group) => ({ title: group.title, items: group.items.filter((item) => granted.has(item.permission)) }))
    .filter((group) => group.items.length > 0);
}

/** Filters the standard (Nonnis operations) navigation by permission. */
export function visibleNav(permissions: readonly string[]): NavGroup[] {
  return filterNav(NAV, permissions);
}

/** Filters the provider-portal navigation by permission. */
export function visibleProviderNav(permissions: readonly string[]): NavGroup[] {
  return filterNav(PROVIDER_NAV, permissions);
}
