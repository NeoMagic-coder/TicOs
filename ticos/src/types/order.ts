export interface OrderWithDetails {
  id: string;
  orderNumber: string;
  platform: string;
  status: string;
  totalAmount: number;
  customerName: string;
  itemsCount: number;
  createdAt: Date;
}

export interface DashboardStats {
  totalOrders: number;
  totalRevenue: number;
  totalCustomers: number;
  totalProducts: number;
  pendingOrders: number;
  monthlyRevenue: number;
  revenueChange: number;
  orderChange: number;
}
