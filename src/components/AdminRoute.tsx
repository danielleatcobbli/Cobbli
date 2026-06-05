import { useIsAdmin } from "@/hooks/useIsAdmin";
import BrandSpinner from "@/components/cobbli/BrandSpinner";
import { useAuth } from "@/context/AuthContext";

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAdmin, loading } = useIsAdmin();
  const { user } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <BrandSpinner />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md text-center space-y-3">
          <h1 className="font-display text-2xl text-primary">Access denied — admin role required</h1>
          <p className="text-sm text-muted-foreground">
            {user
              ? `Signed in as ${user.email}. This account does not have the admin role in user_roles.`
              : "You are not signed in."}
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default AdminRoute;
