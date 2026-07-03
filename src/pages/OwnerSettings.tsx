import Header from "@/components/cobbli/Header";
import Footer from "@/components/cobbli/Footer";
import { usePageMeta } from "@/hooks/usePageMeta";
import ZipManager from "@/components/settings/ZipManager";
import PricingManager from "@/components/settings/PricingManager";
import FeesManager from "@/components/settings/FeesManager";

/**
 * Owner-only Settings: strategic, infrequently-changed config (serviced ZIP
 * codes + pricing), kept separate from the day-to-day Admin operations view.
 * Route is gated by OwnerRoute; writes are independently enforced by
 * owner/admin RLS on the underlying tables.
 */
const OwnerSettings = () => {
  usePageMeta({
    title: "Settings — Cobbli",
    description: "Owner settings for serviced ZIP codes and pricing.",
  });

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <div className="container max-w-2xl py-12 md:py-16 space-y-12">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold">Settings</h1>
            <p className="text-sm text-muted-foreground">
              Manage serviced areas and pricing. Owner only.
            </p>
          </div>
          <ZipManager />
          <PricingManager />
          <FeesManager />
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default OwnerSettings;
