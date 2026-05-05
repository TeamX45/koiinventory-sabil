// Status variant type
export type StatusVariant =
  | "default"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "secondary";

// Preset status mappings for common use cases
export const purchaseStatusMap: Record<
  string,
  { label: string; variant: StatusVariant }
> = {
  draft: { label: "Draft", variant: "secondary" },
  ordered: { label: "Dipesan", variant: "info" },
  partial: { label: "Sebagian", variant: "warning" },
  received: { label: "Diterima", variant: "success" },
  cancelled: { label: "Dibatalkan", variant: "danger" },
};

export const transferStatusMap: Record<
  string,
  { label: string; variant: StatusVariant }
> = {
  draft: { label: "Draft", variant: "secondary" },
  pending: { label: "Menunggu", variant: "warning" },
  approved: { label: "Disetujui", variant: "info" },
  in_transit: { label: "Dalam Perjalanan", variant: "info" },
  received: { label: "Diterima", variant: "success" },
  cancelled: { label: "Dibatalkan", variant: "danger" },
};

export const processStatusMap: Record<
  string,
  { label: string; variant: StatusVariant }
> = {
  pending: { label: "Menunggu", variant: "warning" },
  in_progress: { label: "Berjalan", variant: "info" },
  completed: { label: "Selesai", variant: "success" },
  cancelled: { label: "Dibatalkan", variant: "danger" },
};

export const payrollStatusMap: Record<
  string,
  { label: string; variant: StatusVariant }
> = {
  draft: { label: "Draft", variant: "secondary" },
  approved: { label: "Disetujui", variant: "info" },
  paid: { label: "Dibayar", variant: "success" },
};

export const paymentStatusMap: Record<
  string,
  { label: string; variant: StatusVariant }
> = {
  unpaid: { label: "Belum Lunas", variant: "danger" },
  partial: { label: "Sebagian", variant: "warning" },
  paid: { label: "Lunas", variant: "success" },
};
