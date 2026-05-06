import { api } from './client';
import type {
  Pond, PondCategory, Supplier, Purchase, Sale, Batch, Sorting, Grade, FishType,
  Location, SalesChannel, Harvest, Mortality, MortalitySummary,
  AppUser, StockOpname, PaginatedResponse,
  Expense, ExpenseCategory,
} from '@/types/models';

const v1 = '/v1';

export type ListParams = Record<string, unknown> & {
  page?: number;
  per_page?: number;
};

export const PondsApi = {
  list:    () => api.get<{ data: Pond[] }>(`${v1}/ponds`).then((r) => r.data.data),
  get:     (id: number) => api.get<{ data: Pond }>(`${v1}/ponds/${id}`).then((r) => r.data.data),
  batches: (id: number) => api.get<{ data: Batch[] }>(`${v1}/ponds/${id}/batches`).then((r) => r.data.data),
  create:  (payload: Partial<Pond>) => api.post<{ data: Pond }>(`${v1}/ponds`, payload).then((r) => r.data.data),
  update:  (id: number, payload: Partial<Pond>) =>
    api.put<{ data: Pond }>(`${v1}/ponds/${id}`, payload).then((r) => r.data.data),
  delete:  (id: number) => api.delete(`${v1}/ponds/${id}`),
};

export const SuppliersApi = {
  list:   () => api.get<{ data: Supplier[] }>(`${v1}/suppliers`).then((r) => r.data.data),
  create: (payload: Partial<Supplier>) => api.post<{ data: Supplier }>(`${v1}/suppliers`, payload).then((r) => r.data.data),
  update: (id: number, payload: Partial<Supplier>) => api.put<{ data: Supplier }>(`${v1}/suppliers/${id}`, payload).then((r) => r.data.data),
  delete: (id: number) => api.delete(`${v1}/suppliers/${id}`),
};

export const PurchasesApi = {
  list:    (params?: ListParams) =>
    api.get<PaginatedResponse<Purchase>>(`${v1}/purchases`, { params }).then((r) => r.data),
  create:  (payload: Partial<Purchase>) => api.post<{ data: Purchase }>(`${v1}/purchases`, payload).then((r) => r.data.data),
  update:  (id: number, payload: Partial<Purchase>) =>
    api.put<{ data: Purchase }>(`${v1}/purchases/${id}`, payload).then((r) => r.data.data),
  delete:  (id: number) => api.delete(`${v1}/purchases/${id}`),
  receive: (id: number, payload: { pond_id: number; notes?: string }) =>
    api.post<{ data: Batch }>(`${v1}/purchases/${id}/receive`, payload).then((r) => r.data.data),
};

export const HarvestsApi = {
  list:    (params?: ListParams) =>
    api.get<PaginatedResponse<Harvest>>(`${v1}/harvests`, { params }).then((r) => r.data),
  create:  (payload: Partial<Harvest>) => api.post<{ data: Harvest }>(`${v1}/harvests`, payload).then((r) => r.data.data),
  update:  (id: number, payload: Partial<Harvest>) =>
    api.put<{ data: Harvest }>(`${v1}/harvests/${id}`, payload).then((r) => r.data.data),
  delete:  (id: number) => api.delete(`${v1}/harvests/${id}`),
  receive: (id: number, payload: { staging_pond_id: number; notes?: string }) =>
    api.post<{ data: Batch }>(`${v1}/harvests/${id}/receive`, payload).then((r) => r.data.data),
};

export interface BatchCreatePayload {
  pond_id: number;
  fish_type_id?: number | null;
  grade_id?: number | null;
  count: number;
  size_cm?: number | null;
  size_max_cm?: number | null;
  price_per_fish?: number | null;
  notes?: string;
}

export interface BatchUpdatePayload {
  fish_type_id?: number | null;
  grade_id?: number | null;
  size_cm?: number | null;
  size_max_cm?: number | null;
  price_per_fish?: number | null;
  notes?: string;
}

export const BatchesApi = {
  list:     (params?: ListParams) =>
    api.get<PaginatedResponse<Batch>>(`${v1}/batches`, { params }).then((r) => r.data),
  listAll:  (params?: Record<string, unknown>) =>
    api.get<PaginatedResponse<Batch>>(`${v1}/batches`, { params: { ...params, all: 1 } }).then((r) => r.data.data),
  get:      (id: number) => api.get<{ data: Batch }>(`${v1}/batches/${id}`).then((r) => r.data.data),
  create:   (payload: BatchCreatePayload) =>
    api.post<{ data: Batch }>(`${v1}/batches`, payload).then((r) => r.data.data),
  update:   (id: number, payload: BatchUpdatePayload) =>
    api.put<{ data: Batch }>(`${v1}/batches/${id}`, payload).then((r) => r.data.data),
  delete:   (id: number) => api.delete(`${v1}/batches/${id}`),
  transfer: (id: number, payload: { to_pond_id: number; count: number; notes?: string }) =>
    api.post(`${v1}/batches/${id}/transfer`, payload),
};

interface SortingResultPayload {
  grade_id: number;
  target_pond_id: number;
  fish_type_id?: number | null;
  count: number;
  price_per_fish: number;
  notes?: string;
}

interface SortingPayload {
  source_batch_id: number;
  sorting_date: string;
  total_loss?: number;
  notes?: string;
  results: SortingResultPayload[];
}

export const SortingsApi = {
  list:     (params?: ListParams) =>
    api.get<PaginatedResponse<Sorting>>(`${v1}/sortings`, { params }).then((r) => r.data),
  create:   (payload: SortingPayload) => api.post<{ data: Sorting }>(`${v1}/sortings`, payload).then((r) => r.data.data),
  update:   (id: number, payload: { sorting_date?: string; total_loss?: number; notes?: string }) =>
    api.put<{ data: Sorting }>(`${v1}/sortings/${id}`, payload).then((r) => r.data.data),
  delete:   (id: number) => api.delete(`${v1}/sortings/${id}`),
  complete: (id: number) => api.post<{ data: Sorting }>(`${v1}/sortings/${id}/complete`).then((r) => r.data.data),
};

interface SaleItemPayload {
  batch_id: number;
  count: number;
  price_per_fish: number;
  notes?: string;
}

interface SalePayload {
  sales_channel_id: number;
  sale_date: string;
  customer_name?: string;
  customer_phone?: string;
  customer_address?: string;
  discount?: number;
  shipping_cost?: number;
  status?: string;
  notes?: string;
  items: SaleItemPayload[];
}

export const SalesApi = {
  list:   (params?: ListParams) =>
    api.get<PaginatedResponse<Sale>>(`${v1}/sales`, { params }).then((r) => r.data),
  get:    (id: number) => api.get<{ data: Sale }>(`${v1}/sales/${id}`).then((r) => r.data.data),
  create: (payload: SalePayload) => api.post<{ data: Sale }>(`${v1}/sales`, payload).then((r) => r.data.data),
  update: (id: number, payload: { status?: string; notes?: string }) =>
    api.put<{ data: Sale }>(`${v1}/sales/${id}`, payload).then((r) => r.data.data),
  delete: (id: number) => api.delete(`${v1}/sales/${id}`),
  cancel: (id: number) => api.post(`${v1}/sales/${id}/cancel`),
};

interface MortalityPayload {
  batch_id: number;
  mortality_date: string;
  count: number;
  cause?: string;
  notes?: string;
}

interface MortalityUpdatePayload {
  mortality_date?: string;
  cause?: string | null;
  notes?: string | null;
}

export const MortalitiesApi = {
  list: (params?: ListParams) =>
    api.get<PaginatedResponse<Mortality>>(`${v1}/mortalities`, { params }).then((r) => r.data),
  summary: () =>
    api.get<{ data: MortalitySummary }>(`${v1}/mortalities/summary`).then((r) => r.data.data),
  create: (payload: MortalityPayload) =>
    api.post<{ data: Mortality }>(`${v1}/mortalities`, payload).then((r) => r.data.data),
  update: (id: number, payload: MortalityUpdatePayload) =>
    api.put<{ data: Mortality }>(`${v1}/mortalities/${id}`, payload).then((r) => r.data.data),
  delete: (id: number) => api.delete(`${v1}/mortalities/${id}`),
};

interface UserPayload {
  name: string;
  email: string;
  password?: string;
  role: 'owner' | 'admin' | 'staff';
  phone?: string;
  is_active?: boolean;
}

export const UsersApi = {
  list: (params?: ListParams) =>
    api.get<PaginatedResponse<AppUser>>(`${v1}/users`, { params }).then((r) => r.data),
  get: (id: number) => api.get<{ data: AppUser }>(`${v1}/users/${id}`).then((r) => r.data.data),
  create: (payload: UserPayload) =>
    api.post<{ data: AppUser }>(`${v1}/users`, payload).then((r) => r.data.data),
  update: (id: number, payload: Partial<UserPayload>) =>
    api.put<{ data: AppUser }>(`${v1}/users/${id}`, payload).then((r) => r.data.data),
  delete: (id: number) => api.delete(`${v1}/users/${id}`),
};

export const ExportsApi = {
  inventoryCsv: () =>
    api.get(`${v1}/exports/inventory.csv`, { responseType: 'blob' }).then((r) => r.data as Blob),
  stockOpnamesCsv: (params?: { from?: string; to?: string }) =>
    api.get(`${v1}/exports/stock-opnames.csv`, { params, responseType: 'blob' }).then((r) => r.data as Blob),
};

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const downloadCsv = {
  inventory: async () => {
    const blob = await ExportsApi.inventoryCsv();
    triggerDownload(blob, `inventaris-${new Date().toISOString().slice(0, 10)}.csv`);
  },
  stockOpnames: async (params?: { from?: string; to?: string }) => {
    const blob = await ExportsApi.stockOpnamesCsv(params);
    triggerDownload(blob, `opname-${new Date().toISOString().slice(0, 10)}.csv`);
  },
};

export const ProfileApi = {
  update: (payload: { name?: string; phone?: string }) =>
    api.patch<{ data: AppUser }>(`${v1}/auth/profile`, payload).then((r) => r.data.data),
  changePassword: (payload: { current_password: string; new_password: string; new_password_confirmation: string }) =>
    api.post<{ message: string }>(`${v1}/auth/change-password`, payload).then((r) => r.data),
};

interface StockOpnamePayload {
  batch_id?: number;
  pond_id?: number;
  opname_date: string;
  actual_count: number;
  notes?: string;
}

interface StockOpnameUpdatePayload {
  opname_date?: string;
  actual_count?: number;
  notes?: string;
}

export interface StockOpnameBulkPayload {
  opname_date: string;
  notes?: string;
  rows: { batch_id: number; actual_count: number }[];
}

export const StockOpnamesApi = {
  list:       (params?: ListParams) =>
    api.get<PaginatedResponse<StockOpname>>(`${v1}/stock-opnames`, { params }).then((r) => r.data),
  create:     (payload: StockOpnamePayload) =>
    api.post<{ data: StockOpname }>(`${v1}/stock-opnames`, payload).then((r) => r.data.data),
  createBulk: (payload: StockOpnameBulkPayload) =>
    api.post<{ data: StockOpname[]; message: string }>(`${v1}/stock-opnames/bulk`, payload).then((r) => r.data),
  update:     (id: number, payload: StockOpnameUpdatePayload) =>
    api.put<{ data: StockOpname }>(`${v1}/stock-opnames/${id}`, payload).then((r) => r.data.data),
  delete:     (id: number) => api.delete(`${v1}/stock-opnames/${id}`),
  complete:   (id: number) =>
    api.post<{ data: StockOpname }>(`${v1}/stock-opnames/${id}/complete`).then((r) => r.data.data),
};

export const LocationsApi = {
  list:   () => api.get<{ data: Location[] }>(`${v1}/locations`).then((r) => r.data.data),
  create: (payload: Partial<Location>) =>
    api.post<{ data: Location }>(`${v1}/locations`, payload).then((r) => r.data.data),
  update: (id: number, payload: Partial<Location>) =>
    api.put<{ data: Location }>(`${v1}/locations/${id}`, payload).then((r) => r.data.data),
  delete: (id: number) => api.delete(`${v1}/locations/${id}`),
};

export const PondCategoriesApi = {
  list:   () => api.get<{ data: PondCategory[] }>(`${v1}/pond-categories`).then((r) => r.data.data),
  create: (payload: Partial<PondCategory>) =>
    api.post<{ data: PondCategory }>(`${v1}/pond-categories`, payload).then((r) => r.data.data),
  update: (id: number, payload: Partial<PondCategory>) =>
    api.put<{ data: PondCategory }>(`${v1}/pond-categories/${id}`, payload).then((r) => r.data.data),
  delete: (id: number) => api.delete(`${v1}/pond-categories/${id}`),
};

export const GradesApi = {
  list:   () => api.get<{ data: Grade[] }>(`${v1}/grades`).then((r) => r.data.data),
  create: (payload: Partial<Grade>) =>
    api.post<{ data: Grade }>(`${v1}/grades`, payload).then((r) => r.data.data),
  update: (id: number, payload: Partial<Grade>) =>
    api.put<{ data: Grade }>(`${v1}/grades/${id}`, payload).then((r) => r.data.data),
  delete: (id: number) => api.delete(`${v1}/grades/${id}`),
};

export const ExpenseCategoriesApi = {
  list:   () => api.get<{ data: ExpenseCategory[] }>(`${v1}/expense-categories`).then((r) => r.data.data),
  create: (payload: Partial<ExpenseCategory>) =>
    api.post<{ data: ExpenseCategory }>(`${v1}/expense-categories`, payload).then((r) => r.data.data),
  update: (id: number, payload: Partial<ExpenseCategory>) =>
    api.put<{ data: ExpenseCategory }>(`${v1}/expense-categories/${id}`, payload).then((r) => r.data.data),
  delete: (id: number) => api.delete(`${v1}/expense-categories/${id}`),
};

export interface ExpenseListResponse extends PaginatedResponse<Expense> {
  summary: { total_amount: number; count: number };
}

export interface ExpensePayload {
  expense_date: string;
  expense_category_id: number;
  location_id?: number | null;
  description: string;
  amount: number;
  paid_by?: string;
  payment_method?: string;
  notes?: string;
}

export const ExpensesApi = {
  list:   (params?: ListParams & { from?: string; to?: string; expense_category_id?: number; location_id?: number; q?: string }) =>
    api.get<ExpenseListResponse>(`${v1}/expenses`, { params }).then((r) => r.data),
  get:    (id: number) => api.get<{ data: Expense }>(`${v1}/expenses/${id}`).then((r) => r.data.data),
  create: (payload: ExpensePayload) =>
    api.post<{ data: Expense }>(`${v1}/expenses`, payload).then((r) => r.data.data),
  update: (id: number, payload: Partial<ExpensePayload>) =>
    api.put<{ data: Expense }>(`${v1}/expenses/${id}`, payload).then((r) => r.data.data),
  delete: (id: number) => api.delete(`${v1}/expenses/${id}`),
};

export const MasterApi = {
  locations:     () => api.get<{ data: Location[] }>(`${v1}/locations`).then((r) => r.data.data),
  grades:        () => api.get<{ data: Grade[] }>(`${v1}/grades`).then((r) => r.data.data),
  fishTypes:     () => api.get<{ data: FishType[] }>(`${v1}/fish-types`).then((r) => r.data.data),
  salesChannels: () => api.get<{ data: SalesChannel[] }>(`${v1}/sales-channels`).then((r) => r.data.data),
};
