import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import BrandSpinner from "@/components/cobbli/BrandSpinner";
import { saveReturnTo } from "@/lib/authRedirect";

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
    const fullPath = `${location.pathname}${location.search}${location.hash}`;
    saveReturnTo(fullPath);
    return <Navigate to="/signin" replace state={{ from: fullPath }} />;
  }
  return <>{children}</>;
};

export default ProtectedRoute;

