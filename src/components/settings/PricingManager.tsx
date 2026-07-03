import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePricingAdmin, type PricingRow } from "@/hooks/usePricingAdmin";

const centsToDollars = (cents: number | null): string =>
  cents === null ? "" : String(Math.round(cents / 100));

const PricingRowEditor = ({
  row,
  onSave,
  saving,
}: {
  row: PricingRow;
  onSave: (cents: number | null) => void;
  saving: boolean;
}) => {
  const [value, setValue] = useState(centsToDollars(row.base_price_cents));
  const dirty = value !== centsToDollars(row.base_price_cents);

  const save = () => {
    const trimmed = value.trim();
    onSave(trimmed === "" ? null : Math.round(Number(trimmed) * 100));
  };

  return (
    <li className="flex items-center gap-3 rounded-md border border-border px-3 py-2">
      <span className="flex-1 text-sm">{row.name || row.slug}</span>
      <div className="flex items-center gap-1">
        <span className="text-sm text-muted-foreground">$</span>
        <Input
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/[^\d]/g, ""))}
          placeholder="—"
          className="w-24"
          aria-label={`Base price for ${row.name || row.slug}`}
        />
      </div>
      <Button type="button" size="sm" onClick={save} disabled={!dirty || saving}>
        Save
      </Button>
    </li>
  );
};

const PricingManager = () => {
  const { data: rows, isLoading, error, setBasePrice } = usePricingAdmin();

  return (
    <section className="space-y-4" aria-labelledby="pricing-manager-heading">
      <div>
        <h2 id="pricing-manager-heading" className="text-xl font-semibold">
          Service pricing
        </h2>
        <p className="text-sm text-muted-foreground">
          Base price per service, in whole dollars. Leave blank for services without a flat price.
        </p>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading pricing…</p>}
      {error && <p className="text-sm text-destructive">Could not load pricing.</p>}

      {rows && (
        <ul className="space-y-2">
          {rows.map((row) => (
            <PricingRowEditor
              key={row.id}
              row={row}
              saving={setBasePrice.isPending}
              onSave={(cents) => setBasePrice.mutate({ id: row.id, cents })}
            />
          ))}
        </ul>
      )}
    </section>
  );
};

export default PricingManager;
