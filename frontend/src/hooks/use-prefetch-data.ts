import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  BatchesApi,
  HarvestsApi,
  LocationsApi,
  MasterApi,
  MortalitiesApi,
  PondCategoriesApi,
  PondsApi,
  PurchasesApi,
  SalesApi,
  SortingsApi,
  StockOpnamesApi,
  SuppliersApi,
} from "@/api/endpoints";

/**
 * Prefetch data utama saat user masuk dashboard layout.
 * Begitu user klik menu apapun, data sudah di cache → table langsung tampil
 * tanpa skeleton loading.
 *
 * Query key WAJIB match persis dengan yang dipakai di halaman, terutama
 * pagination key {page: 1}.
 */
export function usePrefetchData() {
  const qc = useQueryClient();

  useEffect(() => {
    // ========== Master Data — jarang berubah, cache panjang ==========
    qc.prefetchQuery({
      queryKey: ["ponds"],
      queryFn: PondsApi.list,
      staleTime: 30 * 60_000,
    });
    qc.prefetchQuery({
      queryKey: ["pond-categories"],
      queryFn: PondCategoriesApi.list,
      staleTime: 30 * 60_000,
    });
    qc.prefetchQuery({
      queryKey: ["locations"],
      queryFn: LocationsApi.list,
      staleTime: 30 * 60_000,
    });
    qc.prefetchQuery({
      queryKey: ["suppliers"],
      queryFn: SuppliersApi.list,
      staleTime: 30 * 60_000,
    });
    qc.prefetchQuery({
      queryKey: ["grades"],
      queryFn: MasterApi.grades,
      staleTime: 60 * 60_000,
    });
    qc.prefetchQuery({
      queryKey: ["fish-types"],
      queryFn: MasterApi.fishTypes,
      staleTime: 60 * 60_000,
    });
    qc.prefetchQuery({
      queryKey: ["sales-channels"],
      queryFn: MasterApi.salesChannels,
      staleTime: 60 * 60_000,
    });

    // ========== Halaman utama — paginated, query key WAJIB match ==========
    qc.prefetchQuery({
      queryKey: ["purchases", { page: 1 }],
      queryFn: () => PurchasesApi.list({ page: 1 }),
    });
    qc.prefetchQuery({
      queryKey: ["harvests", { page: 1 }],
      queryFn: () => HarvestsApi.list({ page: 1 }),
    });
    qc.prefetchQuery({
      queryKey: ["sortings", { page: 1 }],
      queryFn: () => SortingsApi.list({ page: 1 }),
    });
    qc.prefetchQuery({
      queryKey: ["sales", { page: 1 }],
      queryFn: () => SalesApi.list({ page: 1 }),
    });
    qc.prefetchQuery({
      queryKey: ["stock-opnames", { page: 1 }],
      queryFn: () => StockOpnamesApi.list({ page: 1 }),
    });
    qc.prefetchQuery({
      queryKey: ["mortalities", { pondFilter: "all", from: "", to: "", page: 1 }],
      queryFn: () => MortalitiesApi.list({ page: 1 }),
    });
    qc.prefetchQuery({
      queryKey: ["mortalities-summary"],
      queryFn: MortalitiesApi.summary,
    });

    // ========== Batches — beberapa filter ==========
    qc.prefetchQuery({
      queryKey: ["batches", { filter: "active", page: 1 }],
      queryFn: () => BatchesApi.list({ status: "active", page: 1 }),
    });
    qc.prefetchQuery({
      queryKey: ["batches", "active-all"],
      queryFn: () => BatchesApi.listAll({ status: "active" }),
    });
    qc.prefetchQuery({
      queryKey: ["batches", "sellable-all"],
      queryFn: () => BatchesApi.listAll({ status: "active" }),
    });
    qc.prefetchQuery({
      queryKey: ["batches", "unsorted-all"],
      queryFn: () => BatchesApi.listAll({ unsorted: 1 }),
    });
  }, [qc]);
}
