import AdminLayout from "@/components/admin/AdminLayout";
import { usePageMeta } from "@/hooks/usePageMeta";
import KpiDashboard from "@/components/admin/kpi/KpiDashboard";

/**
 * Analytics dashboard — business metrics. Admin only (Danielle may open to
 * Staff later).
 */
const AdminReports = () => {
  usePageMeta({ title: "Reports — Cobbli Admin", description: "Analytics and business metrics." });
  return (
    <AdminLayout>
      <KpiDashboard />
    </AdminLayout>
  );
};

export default AdminReports;
