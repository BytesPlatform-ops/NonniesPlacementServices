export type ProviderStatus = "ACTIVE" | "INACTIVE" | "PAUSED";
export type CapacityStatus = "AVAILABLE" | "LIMITED" | "UNAVAILABLE" | "UNKNOWN";
// Widest to narrowest. A narrow area never implies a wider one.
export type CoverageType = "COUNTRY" | "STATE" | "COUNTY" | "CITY" | "POSTAL_CODE" | "ADDRESS" | "RADIUS";
export type DayOfWeek =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";
export type LevelOfCare = "INDEPENDENT" | "SUPPORTIVE" | "INTERMEDIATE" | "SKILLED" | "COMPLEX";

export interface ProviderSummaryView {
  id: string;
  organizationId: string;
  organizationName: string;
  displayName: string;
  status: ProviderStatus;
  city: string | null;
  state: string | null;
  phone: string | null;
  email: string | null;
  servicesCount: number;
  coverageAreasCount: number;
  languagesCount: number;
  paymentTypesCount: number;
  availabilityStatus: CapacityStatus;
  editable: boolean;
  updatedAt: string;
}

export interface ProviderServiceView {
  id: string;
  serviceCategoryId: string;
  categoryCode: string;
  categoryName: string;
  active: boolean;
  description: string | null;
  levelOfCare: LevelOfCare | null;
  createdAt: string;
  updatedAt: string;
}

export interface CoverageAreaView {
  id: string;
  coverageType: CoverageType;
  country: string;
  city: string | null;
  county: string | null;
  state: string | null;
  postalCode: string | null;
  /** Every postal code this area covers. */
  postalCodes: string[];
  street: string | null;
  addressLine: string | null;
  latitude: number | null;
  longitude: number | null;
  radiusMiles: number | null;
  notes: string | null;
  active: boolean;
}

export type StateCoverageStatus = "FULL" | "PARTIAL" | "NONE";

export interface CoverageSummaryView {
  summary: {
    states: number;
    counties: number;
    cities: number;
    postalCodes: number;
    addresses: number;
    radiusAreas: number;
    totalActive: number;
    countrywide: boolean;
  };
  states: Array<{ state: string; status: StateCoverageStatus; areaCount: number }>;
  /** Pairs of area ids whose radii reach each other. Never merged. */
  overlaps: Array<[string, string]>;
}

export interface ProviderPaymentTypeView {
  id: string;
  paymentTypeId: string;
  code: string;
  name: string;
  active: boolean;
  notes: string | null;
}

export interface ProviderLanguageView {
  id: string;
  languageId: string;
  code: string;
  name: string;
  active: boolean;
}

export interface ProviderHoursView {
  id: string;
  dayOfWeek: DayOfWeek;
  closed: boolean;
  open24: boolean;
  opensAt: string | null;
  closesAt: string | null;
  notes: string | null;
}

export interface ProviderCapacityView {
  id: string;
  serviceCategoryId: string | null;
  categoryCode: string | null;
  categoryName: string | null;
  status: CapacityStatus;
  availableCount: number | null;
  effectiveDate: string | null;
  notes: string | null;
  updatedByName: string | null;
  updatedAt: string;
}

export interface ProviderUserView {
  membershipId: string;
  userId: string;
  email: string;
  name: string | null;
  roleCode: string;
  roleName: string;
  membershipStatus: string;
  userStatus: string;
}

export interface ProviderDetailView {
  id: string;
  organizationId: string;
  organization: { id: string; name: string; type: string; status: string };
  status: ProviderStatus;
  displayName: string;
  description: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  timezone: string | null;
  eligibilityNotes: string | null;
  internalNotes: string | null;
  licenseNumber: string | null;
  licenseType: string | null;
  services: ProviderServiceView[];
  coverageAreas: CoverageAreaView[];
  paymentTypes: ProviderPaymentTypeView[];
  languages: ProviderLanguageView[];
  hours: ProviderHoursView[];
  capacity: ProviderCapacityView[];
  editable: boolean;
  canManageCapacity: boolean;
  publicListing: ProviderPublicListingView;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderPublicListingView {
  isResidentialProvider: boolean;
  published: boolean;
  publishedAt: string | null;
  slug: string | null;
  description: string | null;
  featuredImageUrl: string | null;
  featuredImageStoragePath: string | null;
  sortOrder: number | null;
  ready: boolean;
  missing: string[];
}

export const DAYS_OF_WEEK: DayOfWeek[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

export const COVERAGE_TYPES: CoverageType[] = ["COUNTRY", "STATE", "COUNTY", "CITY", "POSTAL_CODE", "ADDRESS", "RADIUS"];
export const CAPACITY_STATUSES: CapacityStatus[] = ["AVAILABLE", "LIMITED", "UNAVAILABLE", "UNKNOWN"];
export const PROVIDER_STATUSES: ProviderStatus[] = ["ACTIVE", "INACTIVE", "PAUSED"];
export const LEVELS_OF_CARE: LevelOfCare[] = ["INDEPENDENT", "SUPPORTIVE", "INTERMEDIATE", "SKILLED", "COMPLEX"];
