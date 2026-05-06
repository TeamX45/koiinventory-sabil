import { lazy, Suspense } from "react";
import { ThemeProvider } from "next-themes";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { AuthProvider } from "@/contexts/auth-context";
import { FeedbackProvider } from "@/contexts/feedback-context";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Skeleton } from "@/components/ui/skeleton";
// Eager: Login + Dashboard supaya UX awal cepat
import LoginPage from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import NotFoundPage from "@/pages/NotFound";

// Lazy: rute lain di-split per chunk supaya bundle awal lebih kecil
const PondsPage = lazy(() => import("@/pages/Ponds"));
const PondDetailPage = lazy(() => import("@/pages/PondDetail"));
const BatchesPage = lazy(() => import("@/pages/Batches"));
const SuppliersPage = lazy(() => import("@/pages/Suppliers"));
const PurchasesPage = lazy(() => import("@/pages/Purchases"));
const HarvestsPage = lazy(() => import("@/pages/Harvests"));
const MortalitiesPage = lazy(() => import("@/pages/Mortalities"));
const SortingsPage = lazy(() => import("@/pages/Sortings"));
const SalesPage = lazy(() => import("@/pages/Sales"));
const SaleReceiptPage = lazy(() => import("@/pages/SaleReceipt"));
const StockOpnamesPage = lazy(() => import("@/pages/StockOpnames"));
const LocationsPage = lazy(() => import("@/pages/Locations"));
const PondCategoriesPage = lazy(() => import("@/pages/PondCategories"));
const GradesPage = lazy(() => import("@/pages/Grades"));
const UsersPage = lazy(() => import("@/pages/Users"));
const ProfilePage = lazy(() => import("@/pages/Profile"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 30 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function PageFallback() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <AuthProvider>
              <FeedbackProvider>
                <Suspense fallback={<PageFallback />}>
                  <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route
                      path="/"
                      element={
                        <ProtectedRoute>
                          <DashboardLayout />
                        </ProtectedRoute>
                      }
                    >
                      <Route index element={<Navigate to="/dashboard" replace />} />
                      <Route path="dashboard" element={<Dashboard />} />
                      <Route path="ponds" element={<PondsPage />} />
                      <Route path="ponds/:id" element={<PondDetailPage />} />
                      <Route path="batches" element={<BatchesPage />} />
                      <Route path="suppliers" element={<SuppliersPage />} />
                      <Route path="locations" element={<LocationsPage />} />
                      <Route path="pond-categories" element={<PondCategoriesPage />} />
                      <Route path="grades" element={<GradesPage />} />
                      <Route path="purchases" element={<PurchasesPage />} />
                      <Route path="harvests" element={<HarvestsPage />} />
                      <Route path="sortings" element={<SortingsPage />} />
                      <Route path="mortalities" element={<MortalitiesPage />} />
                      <Route path="stock-opnames" element={<StockOpnamesPage />} />
                      <Route path="sales" element={<SalesPage />} />
                      <Route path="sales/:id/receipt" element={<SaleReceiptPage />} />
                      <Route path="settings/profile" element={<ProfilePage />} />
                      <Route
                        path="settings/users"
                        element={
                          <ProtectedRoute requireRoles={["owner"]}>
                            <UsersPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route path="*" element={<NotFoundPage />} />
                    </Route>
                  </Routes>
                </Suspense>
              </FeedbackProvider>
            </AuthProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
