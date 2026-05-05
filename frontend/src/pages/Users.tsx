import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Phone, Shield, UserCircle } from "lucide-react";
import { UsersApi } from "@/api/endpoints";
import {
  PageHeader,
  DataTable,
  Pagination,
  type Column,
} from "@/components/common";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/auth-context";
import { useFeedback } from "@/contexts/feedback-context";
import { extractApiError } from "@/utils/api-error";
import type { AppUser, PaginatedResponse } from "@/types/models";
import { formatDate } from "@/utils/format";

const ROLE_TONE: Record<string, string> = {
  owner: "border-amber-300 text-amber-700 dark:text-amber-400 bg-amber-500/10",
  admin: "border-blue-300 text-blue-700 dark:text-blue-400 bg-blue-500/10",
  staff: "border-emerald-300 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10",
};

interface FormState {
  name: string;
  email: string;
  password: string;
  role: "owner" | "admin" | "staff";
  phone: string;
  is_active: boolean;
}

const emptyForm: FormState = {
  name: "",
  email: "",
  password: "",
  role: "staff",
  phone: "",
  is_active: true,
};

export default function UsersPage() {
  const qc = useQueryClient();
  const { user: me } = useAuth();
  const { success, confirmDelete, dismissSuccess } = useFeedback();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ["users", { page }],
    queryFn: () => UsersApi.list({ page }),
    placeholderData: (prev) => prev,
  });
  const users = data?.data ?? [];
  const meta = data?.meta;

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const create = useMutation({
    mutationFn: UsersApi.create,
    onMutate: (payload) => {
      success({
        title: "Pengguna Ditambahkan",
        message: `${payload.name} (${payload.role}) berhasil dibuat dan dapat login dengan email ${payload.email}.`,
      });
    },
    onError: handleApiError,
    onSettled: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });

  const update = useMutation({
    mutationFn: (vars: { id: number; payload: Partial<FormState> }) =>
      UsersApi.update(vars.id, vars.payload),
    onMutate: async (vars) => {
      const key = ["users", { page }];
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<PaginatedResponse<AppUser>>(key);
      qc.setQueryData<PaginatedResponse<AppUser>>(key, (old) =>
        old
          ? {
              ...old,
              data: old.data.map((u) =>
                u.id === vars.id ? ({ ...u, ...vars.payload } as AppUser) : u,
              ),
            }
          : old,
      );
      success({
        title: "Pengguna Diperbarui",
        message: "Perubahan akun berhasil disimpan.",
      });
      return { previous, key };
    },
    onError: (e, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(ctx.key, ctx.previous);
      handleApiError(e);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });

  const remove = useMutation({
    mutationFn: UsersApi.delete,
    onMutate: async (id) => {
      const key = ["users", { page }];
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<PaginatedResponse<AppUser>>(key);
      qc.setQueryData<PaginatedResponse<AppUser>>(key, (old) =>
        old
          ? {
              ...old,
              data: old.data.filter((u) => u.id !== id),
              meta: { ...old.meta, total: Math.max(0, old.meta.total - 1) },
            }
          : old,
      );
      success({
        title: "Pengguna Dihapus",
        message: "Akun berhasil dihapus dan tidak bisa login lagi.",
      });
      return { previous, key };
    },
    onError: (e, _id, ctx) => {
      if (ctx?.previous) qc.setQueryData(ctx.key, ctx.previous);
      handleApiError(e);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });

  async function handleDelete(user: AppUser) {
    const ok = await confirmDelete({
      title: `Hapus ${user.name}?`,
      description: `Akun ${user.email} (role ${user.role}) akan dihapus permanen. Semua sesi akan diakhiri.`,
      confirmLabel: "Ya, Hapus Pengguna",
    });
    if (ok) remove.mutate(user.id);
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(u: AppUser) {
    setEditing(u);
    setForm({
      name: u.name,
      email: u.email,
      password: "",
      role: u.role,
      phone: u.phone ?? "",
      is_active: u.is_active,
    });
    setOpen(true);
  }

  function submit() {
    const isEditing = editing;
    const data = form;
    setOpen(false);
    setEditing(null);
    setForm(emptyForm);
    if (isEditing) {
      const payload: Partial<FormState> = {
        name: data.name,
        email: data.email,
        role: data.role,
        phone: data.phone || undefined,
        is_active: data.is_active,
      };
      if (data.password) payload.password = data.password;
      update.mutate({ id: isEditing.id, payload });
    } else {
      create.mutate(data);
    }
  }

  function handleApiError(e: unknown) {
    dismissSuccess();
    toast.error(extractApiError(e, "Operasi gagal."));
  }

  const columns: Column<AppUser>[] = [
    {
      key: "name",
      header: "Nama",
      sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-linear-to-br from-amber-500 via-rose-500 to-violet-600 text-[10px] font-bold text-white">
            {row.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
          </div>
          <div>
            <div className="font-medium">{row.name}</div>
            <div className="text-[11px] text-muted-foreground">{row.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      cell: (row) => (
        <Badge variant="outline" className={ROLE_TONE[row.role]}>
          <Shield className="h-3 w-3" />
          {row.role}
        </Badge>
      ),
    },
    {
      key: "phone",
      header: "Telepon",
      cell: (row) =>
        row.phone ? (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground text-[12px]">
            <Phone className="h-3 w-3" />
            {row.phone}
          </span>
        ) : (
          <span className="text-muted-foreground/60 text-[12px]">—</span>
        ),
    },
    {
      key: "is_active",
      header: "Status",
      cell: (row) => (
        <Badge
          variant="outline"
          className={
            row.is_active
              ? "border-emerald-300 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10"
              : "border-slate-300 text-slate-600 dark:text-slate-400"
          }
        >
          {row.is_active ? "aktif" : "non-aktif"}
        </Badge>
      ),
    },
    {
      key: "created_at",
      header: "Bergabung",
      sortable: true,
      cell: (row) => (
        <span className="text-[12px] text-muted-foreground">
          {formatDate(row.created_at)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Aksi",
      headerClassName: "text-right",
      className: "text-right",
      cell: (row) => (
        <div className="flex justify-end gap-1">
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => openEdit(row)}
            title="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => handleDelete(row)}
            disabled={row.id === me?.id}
            title={row.id === me?.id ? "Tidak bisa hapus diri sendiri" : "Hapus"}
          >
            <Trash2 className="h-3.5 w-3.5 text-rose-500" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manajemen Pengguna"
        description="Kelola akun owner, admin, dan staff"
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Tambah Pengguna
          </Button>
        }
      />

      <DataTable
        data={users}
        columns={columns}
        keyExtractor={(u) => String(u.id)}
        isLoading={isLoading}
        searchKey="name"
        searchPlaceholder="Cari nama / email..."
        emptyMessage="Belum ada pengguna."
      />

      <Pagination meta={meta} page={page} onPageChange={setPage} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Pengguna" : "Tambah Pengguna"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Kosongkan kata sandi jika tidak ingin mengubahnya."
                : "Akun baru bisa langsung login dengan kredensial yang dimasukkan."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>
                Nama <span className="text-rose-500">*</span>
              </Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Nama lengkap"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>
                  Email <span className="text-rose-500">*</span>
                </Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="user@dkkoi.com"
                />
              </div>
              <div className="space-y-2">
                <Label>
                  Role <span className="text-rose-500">*</span>
                </Label>
                <Select
                  value={form.role}
                  onValueChange={(v) =>
                    setForm({ ...form, role: v as FormState["role"] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner">Owner</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>
                  Kata Sandi{!editing && <span className="text-rose-500"> *</span>}
                </Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                  placeholder={editing ? "Kosongkan = tidak diubah" : "Min 8 karakter"}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label>Telepon</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="08xx xxxx xxxx"
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/30 px-3 py-2.5">
              <div>
                <Label htmlFor="is-active" className="cursor-pointer">
                  Status Aktif
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Pengguna non-aktif tidak bisa login
                </p>
              </div>
              <Switch
                id="is-active"
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button
              disabled={
                !form.name ||
                !form.email ||
                (!editing && !form.password)
              }
              onClick={submit}
            >
              {editing ? "Simpan Perubahan" : "Tambah"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <p className="text-[11px] text-muted-foreground/70 inline-flex items-center gap-1.5">
        <UserCircle className="h-3 w-3" />
        Hanya owner yang dapat mengelola pengguna. Owner terakhir tidak bisa
        di-demote / dihapus / di-non-aktifkan.
      </p>
    </div>
  );
}
