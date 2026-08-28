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
      { label: "Dashboard", href: "/dashboard", permission: PERMISSIONS.CASES_READ },
      { label: "Cases", href: "/cases", permission: PERMISSIONS.CASES_READ },
      { label: "Providers", href: "/providers", permission: PERMISSIONS.PROVIDERS_READ },
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

/** Filters navigation to the groups/items the given permissions allow. */
export function visibleNav(permissions: readonly string[]): NavGroup[] {
  const granted = new Set(permissions);
  return NAV.map((group) => ({
    title: group.title,
    items: group.items.filter((item) => granted.has(item.permission)),
  })).filter((group) => group.items.length > 0);
}
