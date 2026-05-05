/**
 * Brand configuration. Bisa di-override via environment variable
 * saat build production:
 *
 *   VITE_APP_NAME="Toko Koi Anda"
 *   VITE_APP_TAGLINE="Manajemen inventaris ikan koi"
 *   VITE_APP_YEAR="2026"
 *
 * Dipakai di Login page, Sidebar, Header, footer.
 */
export const brand = {
  name:    import.meta.env.VITE_APP_NAME ?? "DK Koi",
  tagline: import.meta.env.VITE_APP_TAGLINE ?? "Platform Inventaris",
  year:    import.meta.env.VITE_APP_YEAR ?? new Date().getFullYear().toString(),
  description: import.meta.env.VITE_APP_DESCRIPTION ?? "Manajemen inventaris & arus kas",
};
