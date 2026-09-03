import { useEffect, useRef } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { ChangesApi, type ChangeVersions } from "@/api/endpoints";

/**
 * Sinkronisasi lintas-user tanpa refresh halaman.
 *
 * Server menyimpan satu nomor versi per entitas dan menaikkannya setiap ada
 * perubahan. Hook ini poll GET /v1/changes (payload <1 KB, tidak menyentuh
 * tabel data), membandingkan dengan hasil poll sebelumnya, lalu me-refresh
 * HANYA daftar yang benar-benar berubah. Jadi kalau staf lain mencatat
 * penjualan, tabel di layar Anda ikut berubah sendiri.
 *
 * Dipilih polling, bukan WebSocket, karena stack-nya php-fpm di VPS kecil:
 * Reverb butuh proses & port sendiri, sementara jeda 10 detik tidak terasa
 * untuk pekerjaan inventaris.
 */
const POLL_MS = 10_000;
const MAX_BACKOFF_MS = 120_000;

/** Entitas server ke query key React Query yang ikut basi karenanya. */
const ENTITY_QUERY_KEYS: Record<string, string[][]> = {
  ponds: [["ponds"], ["pond"], ["pond-batches"]],
  batches: [["batches"], ["pond-batches"], ["ponds"]],
  purchases: [["purchases"]],
  harvests: [["harvests"]],
  sortings: [["sortings"], ["batches"], ["pond-batches"]],
  sales: [["sales"], ["sale"]],
  mortalities: [["mortalities"], ["mortalities-summary"], ["batches"]],
  "stock-opnames": [["stock-opnames"], ["ponds"], ["pond-batches"]],
  expenses: [["expenses"]],
  "expense-categories": [["expense-categories"]],
  "fish-types": [["fish-types"]],
  grades: [["grades"]],
  locations: [["locations"]],
  "pond-categories": [["pond-categories"]],
  suppliers: [["suppliers"]],
  "sales-channels": [["sales-channels"]],
  users: [["users"]],
  dashboard: [["dashboard-summary"]],
};

function invalidateChanged(
  qc: QueryClient,
  previous: ChangeVersions,
  next: ChangeVersions,
) {
  // Dedupe: beberapa entitas memetakan ke query key yang sama (sortings dan
  // batches misalnya), cukup sekali invalidate per key.
  const keys = new Map<string, string[]>();

  for (const [entity, version] of Object.entries(next)) {
    if (previous[entity] === version) continue;
    for (const key of ENTITY_QUERY_KEYS[entity] ?? []) {
      keys.set(key.join(" "), key);
    }
  }

  for (const key of keys.values()) {
    qc.invalidateQueries({ queryKey: key });
  }
}

export function useRealtimeSync(enabled = true) {
  const qc = useQueryClient();
  // Bertahan lintas render supaya pindah halaman tidak mereset titik acuan.
  const seen = useRef<ChangeVersions | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    let failures = 0;

    const nextDelay = () =>
      failures === 0 ? POLL_MS : Math.min(POLL_MS * 2 ** failures, MAX_BACKOFF_MS);

    function schedule() {
      if (stopped) return;
      clearTimeout(timer);
      timer = setTimeout(poll, nextDelay());
    }

    async function poll() {
      if (stopped) return;

      // Tab di latar belakang atau offline tidak perlu poll: begitu kembali
      // aktif, listener di bawah langsung menjalankan poll susulan.
      if (document.hidden || !navigator.onLine) {
        schedule();
        return;
      }

      try {
        const versions = await ChangesApi.list();
        failures = 0;

        const previous = seen.current;
        seen.current = versions;
        // Poll pertama hanya menetapkan titik acuan, jangan invalidate apa pun:
        // datanya baru saja diambil halaman yang bersangkutan.
        if (previous) invalidateChanged(qc, previous, versions);
      } catch {
        // Server mati, offline, atau kena rate limit: mundur bertahap supaya
        // tidak memperparah keadaan. Sesi habis sudah ditangani interceptor 401.
        failures += 1;
      }

      schedule();
    }

    const wake = () => {
      if (!document.hidden && navigator.onLine) poll();
    };

    document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", wake);
    poll();

    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("online", wake);
    };
  }, [qc, enabled]);
}
