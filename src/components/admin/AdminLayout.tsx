import { Link, useLocation } from "react-router-dom";
import Header from "@/components/cobbli/Header";
import Footer from "@/components/cobbli/Footer";
import { useRole, type Role } from "@/hooks/useRole";
import { cn } from "@/lib/utils";

// Nav entries with the roles allowed to see them. UI layer of enforcement:
// staff never see reports/settings/user-management; the links simply don't
// render. (Middleware-equivalent guards + RLS enforce the rest.)
const NAV: { to: string; label: string; allow: Role[] }[] = [
  { to: "/admin/orders", label: "Orders", allow: ["staff", "admin"] },
  { to: "/admin/reworks", label: "Reworks", allow: ["staff", "admin"] },
  { to: "/admin/reports", label: "Reports", allow: ["admin"] },
  { to: "/admin/settings", label: "Settings", allow: ["admin"] },
  { to: "/admin", label: "User management", allow: ["admin"] },
];

const AdminLayout = ({ children }: { children: React.ReactNode }) => {
  const { role } = useRole();
  const location = useLocation();
  const visible = NAV.filter((n) => role && n.allow.includes(role));

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <div className="border-b border-border bg-muted/30">
        <nav className="container flex flex-wrap gap-1 py-2" aria-label="Admin">
          {visible.map((n) => {
            const active =
              location.pathname === n.to ||
              (n.to !== "/admin" && location.pathname.startsWith(`${n.to}/`));
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <main className="flex-1">
        <div className="container py-8">{children}</div>
      </main>
      <Footer />
    </div>
  );
};

export default AdminLayout;
