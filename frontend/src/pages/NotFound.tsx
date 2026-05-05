import { useNavigate } from "react-router-dom";
import { FileQuestion, ArrowLeft, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl border border-border/50 bg-card p-8 text-center shadow-xl">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-linear-to-br from-amber-500/20 to-rose-500/20 ring-1 ring-border/50">
          <FileQuestion className="h-10 w-10 text-muted-foreground" />
        </div>
        <h1 className="mt-6 text-3xl font-bold tracking-tight">404</h1>
        <p className="mt-2 text-base font-medium">Halaman tidak ditemukan</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Halaman yang Anda cari mungkin sudah dihapus atau alamatnya salah.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
            Kembali
          </Button>
          <Button onClick={() => navigate("/dashboard")}>
            <Home className="h-4 w-4" />
            Beranda
          </Button>
        </div>
      </div>
    </div>
  );
}
