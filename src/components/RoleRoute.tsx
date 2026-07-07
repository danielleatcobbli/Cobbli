import { Navigate } from "react-router-dom";
import BrandSpinner from "@/components/cobbli/BrandSpinner";
import { useAuth } from "@/context/AuthContext";
import { useRole, type Role } from "@/hooks/useRole";

/**
 * Route guard enforcing role-based access to /admin routes (UI layer).
 *
 * This is one of three enforcement layers — it hides/blocks routes in the SPA,
 * but the authoritative enforcement is Supabase RLS at the data layer. A user
 * who bypasses this guard still cannot read/write data their role forbids.
 *
 * - Unauthenticated users hitting a protected route are redirected home
 *   (the founder spec: unauthenticated → homepage, not the sign-in page).
 * - Authenticated users without an allowed role are redirected home.
 */
const RoleRoute = ({
  allow,
  children,
}: {
  allow: Role[];
  children: React.ReactNode;
}) => {
  const { user } = useAuth();
  const { role, loading } = useRole();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <BrandSpinner />
      </div>
    );
  }

  // Not signed in, or signed in without a permitted role → homepage.
  if (!user || !role || !allow.includes(role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default RoleRoute;
