import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import BrandSpinner from "@/components/cobbli/BrandSpinner";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <BrandSpinner />
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/signin" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
};

export default ProtectedRoute;
