import AdminLayout from "@/components/admin/AdminLayout";
import { usePageMeta } from "@/hooks/usePageMeta";

/**
 * Operations dashboard — rework request management. Admin + Staff.
 * Infrastructure scaffold only; the rework-queue UI is a separate card.
 */
const AdminReworks = () => {
  usePageMeta({ title: "Reworks — Cobbli Admin", description: "Rework request management." });
  return (
    <AdminLayout>
      <h1 className="text-2xl font-semibold mb-2">Reworks</h1>
      <p className="text-muted-foreground">
        Rework request management. Dashboard UI is built in the operations-dashboard card.
      </p>
    </AdminLayout>
  );
};

export default AdminReworks;
