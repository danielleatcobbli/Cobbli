import { useIsOwner } from "@/hooks/useIsOwner";
import BrandSpinner from "@/components/cobbli/BrandSpinner";
import { useAuth } from "@/context/AuthContext";

/**
 * Route guard for the Owner-only Settings area. Non-owners (including plain
 * admins and staff) get an access-denied screen. This is a UX gate only —
 * the real enforcement is the owner/admin RLS on service_areas and pricing.
 */
const OwnerRoute = ({ children }: { children: React.ReactNode }) => {
  const { isOwner, loading } = useIsOwner();
  const { user } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <BrandSpinner />
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md text-center space-y-3">
          <h1 className="font-display text-2xl text-primary">Access denied — owner role required</h1>
          <p className="text-sm text-muted-foreground">
            {user
              ? `Signed in as ${user.email}. This account does not have the owner role.`
              : "You are not signed in."}
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default OwnerRoute;
