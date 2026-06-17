export interface ProductWithStats {
  id: string;
  name: string;
  sku: string;
  price: number;
  cost: number | null;
  stock: number;
  category: string | null;
  brand: string | null;
  isActive: boolean;
  totalOrders: number;
  createdAt: Date;
}

export interface ProductFilters {
  search?: string;
  category?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}
