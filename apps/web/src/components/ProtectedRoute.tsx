import { Navigate, Outlet } from "react-router-dom";
import { useMe } from "../api/auth";

export function ProtectedRoute() {
  const { data, isLoading, isError } = useMe();

  if (isLoading) {
    return <div className="screen-center muted">Loading…</div>;
  }
  if (isError || !data) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}
