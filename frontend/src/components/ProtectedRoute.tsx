import { Navigate, useLocation } from "react-router-dom";
import { useAuth, type Role } from "@/contexts/auth-context";

interface Props {
  children: React.ReactNode;
  requireRoles?: Role[];
}

export function ProtectedRoute({ children, requireRoles }: Props) {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (requireRoles && requireRoles.length > 0 && !requireRoles.includes(user!.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
