export interface ServiceCategoryView {
  id: string;
  code: string;
  name: string;
  description: string | null;
  active: boolean;
  sortOrder: number;
  providerServicesCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReferenceItemView {
  id: string;
  code: string;
  name: string;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}
