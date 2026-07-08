import AdminLayout from "@/components/admin/AdminLayout";
import { usePageMeta } from "@/hooks/usePageMeta";

/**
 * Analytics dashboard — business metrics. Admin only (Danielle may open to
 * Staff later). Infrastructure scaffold; the analytics UI is a separate card.
 */
const AdminReports = () => {
  usePageMeta({ title: "Reports — Cobbli Admin", description: "Analytics and business metrics." });
  return (
    <AdminLayout>
      <h1 className="text-2xl font-semibold mb-2">Reports</h1>
      <p className="text-muted-foreground">
        Analytics and business metrics. Dashboard UI is built in the analytics-dashboard card.
      </p>
    </AdminLayout>
  );
};

export default AdminReports;
