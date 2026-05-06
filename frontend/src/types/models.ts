export interface Location {
  id: number;
  code: string;
  name: string;
  type: 'filter' | 'tanah';
  address?: string | null;
  notes?: string | null;
  ponds_count?: number;
}

export interface PaginationMeta {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface PondCategory {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  is_breeding: boolean;
  is_grow_out: boolean;
  ponds_count?: number;
}

export interface Pond {
  id: number;
  code: string;
  name: string;
  location_id: number;
  pond_category_id: number;
  capacity: number | null;
  target_min_size_cm: number | null;
  target_max_size_cm: number | null;
  grow_duration_months: number | null;
  is_active: boolean;
  current_stock?: number;
  location?: Location;
  category?: PondCategory;
}

export interface FishType {
  id: number;
  code: string;
  name: string;
  group: 'koi' | 'penjinak';
}

export interface Grade {
  id: number;
  code: string;
  name: string;
  rank: number;
}

export interface SalesChannel {
  id: number;
  code: string;
  name: string;
  type: 'marketplace' | 'social_media' | 'offline' | 'other';
  is_active: boolean;
}

export interface Supplier {
  id: number;
  code: string;
  name: string;
  location?: string | null;
  phone?: string | null;
  is_active: boolean;
}

export interface Purchase {
  id: number;
  code: string;
  supplier_id: number;
  purchase_date: string;
  total_count: number;
  subtotal: number | string;
  avg_price_per_fish: number | string;
  status: 'pending' | 'received' | 'sorted' | 'cancelled';
  supplier?: Supplier;
}

export interface AppUser {
  id: number;
  name: string;
  email: string;
  email_verified_at: string | null;
  role: 'owner' | 'admin' | 'staff';
  is_active: boolean;
  avatar?: string | null;
  phone?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Mortality {
  id: number;
  batch_id: number;
  mortality_date: string;
  count: number;
  cause: string | null;
  notes: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
  batch?: Batch;
}

export interface StockOpname {
  id: number;
  code: string;
  batch_id: number;
  opname_date: string;
  system_count: number;
  actual_count: number;
  difference: number;
  status: 'draft' | 'completed' | 'cancelled';
  notes: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
  batch?: Batch;
}

export interface MortalitySummary {
  total_this_month: number;
  total_this_week: number;
  total_all_time: number;
  top_causes: { cause: string; total: number | string }[];
  top_ponds: { pond_id: number; pond_code: string; pond_name: string; total: number | string }[];
  trend_14_days: { date: string; total: number }[];
}

export interface Harvest {
  id: number;
  code: string;
  source_pond_id: number;
  harvest_date: string;
  total_count: number;
  status: 'pending' | 'harvested' | 'sorted' | 'cancelled';
  source_pond?: Pond;
}

export interface Batch {
  id: number;
  code: string;
  source_type: 'purchase' | 'harvest' | 'sorting' | 'manual' | 'opname';
  source_id: number | null;
  parent_batch_id: number | null;
  pond_id: number;
  fish_type_id: number | null;
  grade_id: number | null;
  initial_count: number;
  current_count: number;
  size_cm: number | null;
  size_max_cm: number | null;
  price_per_fish: number | string | null;
  entry_date: string;
  status: 'active' | 'depleted' | 'archived';
  notes?: string | null;
  pond?: Pond;
  grade?: Grade;
  fish_type?: FishType;
}

export interface Sorting {
  id: number;
  code: string;
  source_batch_id: number;
  sorting_date: string;
  total_sorted: number;
  total_loss: number;
  status: 'draft' | 'completed' | 'cancelled';
  source_batch?: Batch;
  results?: SortingResult[];
}

export interface SortingResult {
  id: number;
  sorting_id: number;
  grade_id: number;
  target_pond_id: number;
  fish_type_id: number | null;
  target_batch_id: number | null;
  count: number;
  price_per_fish: number | string;
  grade?: Grade;
  target_pond?: Pond;
  target_batch?: Batch;
  fish_type?: FishType;
}

export interface Sale {
  id: number;
  code: string;
  sales_channel_id: number;
  sale_date: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_address?: string | null;
  subtotal: number | string;
  discount: number | string;
  shipping_cost: number | string;
  total: number | string;
  status: 'draft' | 'paid' | 'shipped' | 'completed' | 'cancelled';
  notes?: string | null;
  channel?: SalesChannel;
  items?: SaleItem[];
}

export interface SaleItem {
  id: number;
  sale_id: number;
  batch_id: number;
  count: number;
  price_per_fish: number | string;
  subtotal: number | string;
  batch?: Batch;
}
