import { useMemo } from "react";
import { useServices } from "@/hooks/useServices";
import { canonicalPackageSlug, usePackagePrices } from "@/hooks/usePackagePrices";
import { fullResolePrice, priceForShoeType, type ShoeType } from "@/types/service";
import type { BagPair, BagService } from "@/context/BagContext";

/**
 * Recomputes each bag service's price from the current price list so the bag
 * and checkout always reflect today's prices — never the snapshot stored at
 * the time the item was added.
 *
 * Falls back to the stored snapshot price only if the service can't be found
 * in the live catalog (e.g. it was removed).
 */
export const useLivePricedBag = (pairs: BagPair[]) => {
  const { data: services, isLoading } = useServices();
  const { data: packagePrices, isLoading: packagePricesLoading } = usePackagePrices();

  return useMemo(() => {
    const bySlug = new Map((services ?? []).map((s) => [s.slug, s]));

    const livePairs = pairs.map((p) => {
      const shoeType = p.shoeType as ShoeType | undefined;
      const liveServices: BagService[] = p.services.map((svc) => {
        if (svc.id.startsWith("bundle-")) {
          const packageSlug = canonicalPackageSlug(svc.id.slice("bundle-".length));
          const packagePrice = packagePrices?.[packageSlug];
          return typeof packagePrice === "number"
            ? { ...svc, id: `bundle-${packageSlug}`, price: packagePrice }
            : svc;
        }
        const live = bySlug.get(svc.id);
        if (!live || !shoeType) return svc;
        let priceDollars: number | null = null;
        if (live.slug === "full-resole" && svc.soleMaterial) {
          priceDollars = fullResolePrice(live, !!svc.premium, svc.soleMaterial);
        }
        if (priceDollars === null) priceDollars = priceForShoeType(live, shoeType);
        return { ...svc, price: priceDollars * 100, name: live.name };
      });
      return { ...p, services: liveServices };
    });

    const subtotal = livePairs.reduce(
      (sum, p) => sum + p.services.reduce((s, svc) => s + svc.price, 0),
      0,
    );

    return {
      pairs: livePairs,
      subtotal,
      isLoading: isLoading || packagePricesLoading,
    };
  }, [pairs, services, packagePrices, isLoading, packagePricesLoading]);
};
