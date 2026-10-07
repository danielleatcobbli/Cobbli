import AdminLayout from "@/components/admin/AdminLayout";
import { usePageMeta } from "@/hooks/usePageMeta";
import PilotOverview from "@/components/admin/kpi/PilotOverview";

/**
 * Analytics dashboard — business metrics. Admin only (Danielle may open to
 * Staff later).
 */
const AdminReports = () => {
  usePageMeta({ title: "Reports — Cobbli Admin", description: "Analytics and business metrics." });
  return (
    <AdminLayout>
      <PilotOverview />
    </AdminLayout>
  );
};

export default AdminReports;
