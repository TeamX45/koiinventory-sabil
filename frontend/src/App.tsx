import { ThemeProvider } from "next-themes";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { AuthProvider } from "@/contexts/auth-context";
import { FeedbackProvider } from "@/contexts/feedback-context";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import NotFoundPage from "@/pages/NotFound";
import LoginPage from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import PondsPage from "@/pages/Ponds";
import PondDetailPage from "@/pages/PondDetail";
import BatchesPage from "@/pages/Batches";
import SuppliersPage from "@/pages/Suppliers";
import PurchasesPage from "@/pages/Purchases";
import HarvestsPage from "@/pages/Harvests";
import MortalitiesPage from "@/pages/Mortalities";
import SortingsPage from "@/pages/Sortings";
import SalesPage from "@/pages/Sales";
import StockOpnamesPage from "@/pages/StockOpnames";
import LocationsPage from "@/pages/Locations";
import PondCategoriesPage from "@/pages/PondCategories";
import UsersPage from "@/pages/Users";
import ProfilePage from "@/pages/Profile";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache lama tetap ditampilkan (snappy navigation), refetch background bila stale
      staleTime: 60_000,        // 1 menit fresh — invalidate tetap force refetch
      gcTime: 30 * 60_000,      // 30 menit cache di memory
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <AuthProvider>
              <FeedbackProvider>
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
                  <Route path="purchases" element={<PurchasesPage />} />
                  <Route path="harvests" element={<HarvestsPage />} />
                  <Route path="sortings" element={<SortingsPage />} />
                  <Route path="mortalities" element={<MortalitiesPage />} />
                  <Route path="stock-opnames" element={<StockOpnamesPage />} />
                  <Route path="sales" element={<SalesPage />} />
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
              </FeedbackProvider>
            </AuthProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
