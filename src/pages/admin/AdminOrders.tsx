import AdminLayout from "@/components/admin/AdminLayout";
import { usePageMeta } from "@/hooks/usePageMeta";

/**
 * Operations dashboard — order & proposal management. Admin + Staff.
 * Infrastructure scaffold: the order-list / proposal-management UI is built in
 * the separate operations-dashboard card. Access + routing are enforced here.
 */
const AdminOrders = () => {
  usePageMeta({ title: "Orders — Cobbli Admin", description: "Order and proposal management." });
  return (
    <AdminLayout>
      <h1 className="text-2xl font-semibold mb-2">Orders</h1>
      <p className="text-muted-foreground">
        Order and proposal management. Dashboard UI is built in the operations-dashboard card.
      </p>
    </AdminLayout>
  );
};

export default AdminOrders;
