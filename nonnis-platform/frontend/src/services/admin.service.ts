import { apiGet, apiPatch, apiPost } from "@/lib/api-client";
import type { PaginatedResult } from "@/types/api";
import type {
  FacilityView,
  OrganizationView,
  RoleOption,
  UserDetailView,
  UserListItem,
} from "@/types/admin";

// ---- Organizations ----

export function listOrganizations(params: { page?: number; q?: string } = {}): Promise<PaginatedResult<OrganizationView>> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.q) query.set("q", params.q);
  const qs = query.toString();
  return apiGet<PaginatedResult<OrganizationView>>(`/api/v1/organizations${qs ? `?${qs}` : ""}`);
}

export function getOrganization(id: string): Promise<OrganizationView> {
  return apiGet<OrganizationView>(`/api/v1/organizations/${id}`);
}

export function createOrganization(body: { type: string; name: string; legalName?: string }): Promise<OrganizationView> {
  return apiPost<OrganizationView>("/api/v1/organizations", body);
}

export function updateOrganization(id: string, body: { name?: string; legalName?: string }): Promise<OrganizationView> {
  return apiPatch<OrganizationView>(`/api/v1/organizations/${id}`, body);
}

export function setOrganizationStatus(id: string, status: string): Promise<OrganizationView> {
  return apiPatch<OrganizationView>(`/api/v1/organizations/${id}/status`, { status });
}

// ---- Facilities ----

export function listFacilities(params: { page?: number; q?: string } = {}): Promise<PaginatedResult<FacilityView>> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.q) query.set("q", params.q);
  const qs = query.toString();
  return apiGet<PaginatedResult<FacilityView>>(`/api/v1/facilities${qs ? `?${qs}` : ""}`);
}

export function createFacility(body: {
  name: string;
  city?: string;
  state?: string;
  phone?: string;
}): Promise<FacilityView> {
  return apiPost<FacilityView>("/api/v1/facilities", body);
}

export function setFacilityStatus(id: string, status: string): Promise<FacilityView> {
  return apiPatch<FacilityView>(`/api/v1/facilities/${id}/status`, { status });
}

// ---- Users ----

export function listUsers(params: { page?: number; q?: string } = {}): Promise<PaginatedResult<UserListItem>> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.q) query.set("q", params.q);
  const qs = query.toString();
  return apiGet<PaginatedResult<UserListItem>>(`/api/v1/users${qs ? `?${qs}` : ""}`);
}

export function assignableRoles(): Promise<RoleOption[]> {
  return apiGet<RoleOption[]>("/api/v1/users/assignable-roles");
}

export function inviteUser(body: {
  email: string;
  organizationId: string;
  roleCode: string;
  firstName?: string;
  lastName?: string;
}): Promise<{ userId: string; email: string; organizationId: string; roleCode: string; status: string }> {
  return apiPost("/api/v1/users/invite", body);
}

export function setUserStatus(id: string, status: string): Promise<UserDetailView> {
  return apiPatch<UserDetailView>(`/api/v1/users/${id}/status`, { status });
}

export function changeMembershipRole(userId: string, membershipId: string, roleCode: string): Promise<UserDetailView> {
  return apiPatch<UserDetailView>(`/api/v1/users/${userId}/memberships/${membershipId}`, { roleCode });
}
