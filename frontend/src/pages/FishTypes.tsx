import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Fish, ImagePlus, X, CornerDownRight, GitBranchPlus } from "lucide-react";
import { FishTypesApi, MasterApi, PondsApi, type FishTypePayload } from "@/api/endpoints";
import { useFeedback } from "@/contexts/feedback-context";
import { extractApiError } from "@/utils/api-error";
import { PageHeader, DataTable, type Column } from "@/components/common";
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
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { FishType } from "@/types/models";

interface FormState {
  name: string;
  group: "koi" | "penjinak";
  parent_id: number | null;
  default_grade_id: number | null;
  default_pond_id: number | null;
  /** Berkas baru yang dipilih pengguna; null = tidak mengubah foto */
  image: File | null;
  /** Pratinjau: object URL berkas baru, atau URL foto yang sudah tersimpan */
  preview: string | null;
  /** Tandai hapus foto yang sudah ada */
  removeImage: boolean;
}

const emptyForm: FormState = {
  name: "",
  group: "koi",
  parent_id: null,
  default_grade_id: null,
  default_pond_id: null,
  image: null,
  preview: null,
  removeImage: false,
};

export default function FishTypesPage() {
  const qc = useQueryClient();
  const { success, confirmDelete, dismissSuccess } = useFeedback();

  const { data, isLoading } = useQuery({
    queryKey: ["fish-types"],
    queryFn: FishTypesApi.list,
  });
  const { data: grades } = useQuery({
    queryKey: ["grades"],
    queryFn: MasterApi.grades,
  });
  const { data: ponds } = useQuery({
    queryKey: ["ponds"],
    queryFn: PondsApi.list,
  });

  const [groupFilter, setGroupFilter] = useState<"all" | "koi" | "penjinak">(
    "all",
  );
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FishType | null>(null);
  /** Terisi saat dialog dibuka lewat tombol "Tambah Varian" pada suatu induk. */
  const [lockedParent, setLockedParent] = useState<FishType | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  // Susun induk lalu anak-anaknya tepat di bawahnya, supaya tabel terbaca
  // bertingkat tanpa komponen tree terpisah.
  const filtered = useMemo(() => {
    const all = (data ?? []).filter(
      (f) => groupFilter === "all" || f.group === groupFilter,
    );
    const byName = (a: FishType, b: FishType) => a.name.localeCompare(b.name);
    const roots = all.filter((f) => !f.parent_id).sort(byName);
    const childrenOf = (id: number) =>
      all.filter((f) => f.parent_id === id).sort(byName);

    const ordered: FishType[] = [];
    for (const root of roots) {
      ordered.push(root);
      ordered.push(...childrenOf(root.id));
    }
    // Sub-jenis yang induknya tersaring keluar oleh filter group tetap tampil.
    const shown = new Set(ordered.map((f) => f.id));
    ordered.push(...all.filter((f) => !shown.has(f.id)).sort(byName));
    return ordered;
  }, [data, groupFilter]);

  /** Hanya jenis tingkat atas yang boleh jadi induk (batas 2 tingkat). */
  const parentOptions = useMemo(
    () =>
      (data ?? [])
        .filter((f) => !f.parent_id && f.id !== editing?.id)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [data, editing],
  );

  /** Jenis yang punya anak tidak boleh dijadikan sub-jenis. */
  const editingHasChildren = useMemo(
    () => !!editing && (data ?? []).some((f) => f.parent_id === editing.id),
    [data, editing],
  );

  const create = useMutation({
    mutationFn: FishTypesApi.create,
    onMutate: async (payload) => {
      await qc.cancelQueries({ queryKey: ["fish-types"] });
      const previous = qc.getQueryData<FishType[]>(["fish-types"]);
      const tempId = -Date.now();
      const optimistic = {
        id: tempId,
        code: "...",
        ...payload,
      } as FishType;
      qc.setQueryData<FishType[]>(["fish-types"], (old) =>
        [...(old ?? []), optimistic].sort((a, b) =>
          a.group === b.group
            ? a.name.localeCompare(b.name)
            : a.group.localeCompare(b.group),
        ),
      );
      success({
        title: "Jenis Ikan Ditambah",
        message: `${payload.name} tersimpan.`,
      });
      return { previous, tempId };
    },
    onSuccess: (data, _vars, ctx) => {
      qc.setQueryData<FishType[]>(["fish-types"], (old) =>
        (old ?? []).map((f) => (f.id === ctx?.tempId ? data : f)),
      );
    },
    onError: (e, _vars, ctx) => {
      dismissSuccess();
      if (ctx?.previous) qc.setQueryData(["fish-types"], ctx.previous);
      toast.error(extractApiError(e, "Gagal menambah jenis ikan."));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["fish-types"] }),
  });

  const update = useMutation({
    mutationFn: (vars: { id: number; payload: FishTypePayload }) =>
      FishTypesApi.update(vars.id, vars.payload),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["fish-types"] });
      const previous = qc.getQueryData<FishType[]>(["fish-types"]);
      qc.setQueryData<FishType[]>(["fish-types"], (old) =>
        (old ?? []).map((f) =>
          f.id === vars.id ? { ...f, ...vars.payload } : f,
        ),
      );
      success({
        title: "Jenis Ikan Diperbarui",
        message: "Perubahan tersimpan.",
      });
      return { previous };
    },
    onError: (e, _vars, ctx) => {
      dismissSuccess();
      if (ctx?.previous) qc.setQueryData(["fish-types"], ctx.previous);
      toast.error(extractApiError(e, "Gagal memperbarui jenis ikan."));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["fish-types"] }),
  });

  const remove = useMutation({
    mutationFn: FishTypesApi.delete,
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["fish-types"] });
      const previous = qc.getQueryData<FishType[]>(["fish-types"]);
      qc.setQueryData<FishType[]>(["fish-types"], (old) =>
        (old ?? []).filter((f) => f.id !== id),
      );
      success({
        title: "Jenis Ikan Dihapus",
        message: "Jenis ikan dihapus.",
      });
      return { previous };
    },
    onError: (e, _id, ctx) => {
      dismissSuccess();
      if (ctx?.previous) qc.setQueryData(["fish-types"], ctx.previous);
      toast.error(extractApiError(e, "Gagal menghapus jenis ikan."));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["fish-types"] }),
  });

  function openCreate() {
    setEditing(null);
    setLockedParent(null);
    setForm(emptyForm);
    setOpen(true);
  }

  /** Tambah varian langsung dari baris induknya — induk sudah terkunci. */
  function openAddVariant(parent: FishType) {
    setEditing(null);
    setLockedParent(parent);
    setForm({ ...emptyForm, parent_id: parent.id, group: parent.group });
    setOpen(true);
  }

  function openEdit(f: FishType) {
    setEditing(f);
    setForm({
      name: f.name,
      group: f.group,
      parent_id: f.parent_id ?? null,
      default_grade_id: f.default_grade_id ?? null,
      default_pond_id: f.default_pond_id ?? null,
      image: null,
      preview: f.image_url ?? null,
      removeImage: false,
    });
    setOpen(true);
  }

  /** Lepas object URL pratinjau supaya tidak bocor di memori. */
  function releasePreview(current: FormState) {
    if (current.image && current.preview) URL.revokeObjectURL(current.preview);
  }

  function pickImage(file: File | null) {
    setForm((prev) => {
      releasePreview(prev);
      return {
        ...prev,
        image: file,
        preview: file ? URL.createObjectURL(file) : null,
        removeImage: false,
      };
    });
  }

  function clearImage() {
    setForm((prev) => {
      releasePreview(prev);
      return { ...prev, image: null, preview: null, removeImage: true };
    });
  }

  function closeDialog() {
    setForm((prev) => {
      releasePreview(prev);
      return prev;
    });
    setOpen(false);
  }

  function submit() {
    const isEditing = editing;
    const payload = {
      name: form.name,
      group: form.group,
      parent_id: form.parent_id,
      default_grade_id: form.default_grade_id,
      default_pond_id: form.default_pond_id,
      ...(form.image ? { image: form.image } : {}),
      ...(form.removeImage ? { remove_image: true } : {}),
    };
    setOpen(false);
    setEditing(null);
    setForm(emptyForm);
    if (isEditing) {
      update.mutate({ id: isEditing.id, payload });
    } else {
      create.mutate(payload);
    }
  }

  async function handleDelete(f: FishType) {
    const ok = await confirmDelete({
      title: `Hapus ${f.name}?`,
      description: `Jenis ikan ${f.name} akan dihapus permanen. Kalau masih dipakai baris ikan, sistem akan menolak.`,
      confirmLabel: "Ya, Hapus",
    });
    if (ok) remove.mutate(f.id);
  }

  const columns: Column<FishType>[] = [
    {
      key: "image",
      header: "Foto",
      className: "w-14",
      cell: (row) =>
        row.image_url ? (
          <img
            src={row.image_url}
            alt={row.name}
            loading="lazy"
            className="h-9 w-9 rounded-md object-cover border border-border/50"
          />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-md border border-dashed border-border/60 text-muted-foreground/50">
            <Fish className="h-4 w-4" />
          </div>
        ),
    },
    {
      key: "name",
      header: "Nama",
      sortable: true,
      cell: (row) =>
        row.parent_id ? (
          // Sub-jenis: menjorok ke dalam + nama induk agar tak ambigu
          // walaupun tabel diurutkan ulang oleh pengguna.
          <span className="inline-flex items-center gap-1.5 pl-4">
            <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
            <span className="font-medium">{row.name}</span>
            <span className="text-[11px] text-muted-foreground">
              · {row.parent?.name ?? "sub-jenis"}
            </span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 font-medium">
            <Fish className="h-3.5 w-3.5 text-cyan-500" />
            {row.name}
          </span>
        ),
    },
    {
      key: "group",
      header: "Group",
      cell: (row) => (
        <Badge
          variant="outline"
          className={
            row.group === "koi"
              ? "border-cyan-300 text-cyan-700 dark:text-cyan-400 bg-cyan-500/10"
              : "border-amber-300 text-amber-700 dark:text-amber-400 bg-amber-500/10"
          }
        >
          {row.group === "koi" ? "Koi" : "Penjinak"}
        </Badge>
      ),
    },
    {
      key: "defaults",
      header: "Bawaan",
      cell: (row) =>
        row.default_grade || row.default_pond ? (
          <div className="flex flex-wrap gap-1">
            {row.default_grade && (
              <Badge variant="outline" className="border-amber-300 text-amber-700 dark:text-amber-400 bg-amber-500/10">
                {row.default_grade.name}
              </Badge>
            )}
            {row.default_pond && (
              <Badge variant="outline" className="border-cyan-300 text-cyan-700 dark:text-cyan-400 bg-cyan-500/10">
                {row.default_pond.name}
              </Badge>
            )}
          </div>
        ) : (
          <span className="text-[11px] text-muted-foreground/50">—</span>
        ),
    },
    {
      key: "code",
      header: "Kode",
      cell: (row) => (
        <span className="font-mono text-[11px] text-muted-foreground">
          {row.code}
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
          {!row.parent_id && (
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => openAddVariant(row)}
              title={`Tambah varian ${row.name}`}
            >
              <GitBranchPlus className="h-3.5 w-3.5 text-cyan-500" />
            </Button>
          )}
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
            title="Hapus"
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
        title="Jenis Ikan"
        description="Master data varietas ikan koi & penjinak — dipakai di form kolam, batch, dan opname"
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Tambah Jenis
          </Button>
        }
      />

      <Tabs
        value={groupFilter}
        onValueChange={(v) => setGroupFilter(v as typeof groupFilter)}
      >
        <TabsList>
          <TabsTrigger value="all">Semua ({data?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="koi">
            Koi ({(data ?? []).filter((f) => f.group === "koi").length})
          </TabsTrigger>
          <TabsTrigger value="penjinak">
            Penjinak ({(data ?? []).filter((f) => f.group === "penjinak").length})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <DataTable
        data={filtered}
        columns={columns}
        keyExtractor={(f) => String(f.id)}
        isLoading={isLoading}
        searchKey="name"
        searchPlaceholder="Cari jenis (mis. Kohaku, Karasi)..."
        emptyMessage="Belum ada jenis ikan."
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing
                ? `Edit ${editing.name}`
                : lockedParent
                  ? `Tambah Varian ${lockedParent.name}`
                  : "Tambah Jenis Ikan"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Ubah nama, group, induk, atau foto. Kode (auto) tidak bisa diubah."
                : "Tambah varietas ikan baru. Bisa dijadikan sub-jenis dari jenis lain."}
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
                placeholder="mis. Tancho Kohaku, Slayer Kohaku"
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label>
                Group <span className="text-rose-500">*</span>
              </Label>
              <Select
                value={form.group}
                onValueChange={(v) =>
                  setForm({ ...form, group: v as "koi" | "penjinak" })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="koi">Koi (varietas show/grade)</SelectItem>
                  <SelectItem value="penjinak">
                    Penjinak (komoditas, bukan koi murni)
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Group dipakai untuk filter laporan & dropdown.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Induk (opsional)</Label>
              <Select
                value={form.parent_id ? String(form.parent_id) : "none"}
                onValueChange={(v) =>
                  setForm({ ...form, parent_id: v === "none" ? null : Number(v) })
                }
                disabled={editingHasChildren || !!lockedParent}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tanpa induk — jenis tingkat atas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    Tanpa induk — jenis tingkat atas
                  </SelectItem>
                  {parentOptions.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                {lockedParent
                  ? `Varian dari ${lockedParent.name}.`
                  : editingHasChildren
                    ? "Jenis ini punya sub-jenis, jadi tidak bisa dijadikan sub-jenis dari yang lain."
                    : "Pilih induk untuk membuat sub-jenis, mis. Kohaku → Tancho. Maksimal 2 tingkat."}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Grade bawaan</Label>
                <Select
                  value={form.default_grade_id ? String(form.default_grade_id) : "none"}
                  onValueChange={(v) =>
                    setForm({ ...form, default_grade_id: v === "none" ? null : Number(v) })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Tidak ada" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Tidak ada</SelectItem>
                    {grades?.map((g) => (
                      <SelectItem key={g.id} value={String(g.id)}>
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Kolam bawaan</Label>
                <Select
                  value={form.default_pond_id ? String(form.default_pond_id) : "none"}
                  onValueChange={(v) =>
                    setForm({ ...form, default_pond_id: v === "none" ? null : Number(v) })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Tidak ada" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Tidak ada</SelectItem>
                    {ponds?.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground -mt-2">
              Setelan bawaan hanya mengisi form secara otomatis saat varian ini
              dipilih — tidak mencatat ikan masuk stok.
            </p>

            <div className="space-y-2">
              <Label>Foto acuan (opsional)</Label>
              <div className="flex items-start gap-3">
                {form.preview ? (
                  <div className="relative">
                    <img
                      src={form.preview}
                      alt="Pratinjau"
                      className="h-20 w-20 rounded-md object-cover border border-border/50"
                    />
                    <button
                      type="button"
                      onClick={clearImage}
                      title="Hapus foto"
                      className="absolute -right-2 -top-2 rounded-full bg-rose-500 p-1 text-white shadow hover:bg-rose-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border/60 text-muted-foreground/70 transition hover:border-border hover:text-foreground">
                    <ImagePlus className="h-5 w-5" />
                    <span className="text-[10px]">Pilih foto</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => pickImage(e.target.files?.[0] ?? null)}
                    />
                  </label>
                )}
                <p className="text-[11px] text-muted-foreground">
                  JPG, PNG, atau WebP. Maksimal 2 MB.
                  <br />
                  Dipakai sebagai contoh bentuk ikan saat menyortir.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Batal
            </Button>
            <Button disabled={!form.name} onClick={submit}>
              {editing ? "Simpan Perubahan" : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
