import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  usePricingConfig,
  PRICING_CONFIG_DEFAULTS,
  type PricingConfigKey,
} from "@/hooks/usePricingConfig";
import { usePricingConfigMutations } from "@/hooks/usePricingConfigMutations";

const FEE_FIELDS: { key: PricingConfigKey; label: string; help: string }[] = [
  { key: "courier_fee_cents", label: "Courier fee", help: "Charged when the order is below the free-courier threshold." },
  { key: "free_courier_threshold_cents", label: "Free courier threshold", help: "Order subtotal at or above which courier is free." },
  { key: "assessment_deposit_cents", label: "Assessment deposit (per pair)", help: "Held per pair during a photo assessment." },
];

const FeeRow = ({
  field,
  cents,
  onSave,
  saving,
}: {
  field: (typeof FEE_FIELDS)[number];
  cents: number;
  onSave: (cents: number) => void;
  saving: boolean;
}) => {
  const [value, setValue] = useState(String(Math.round(cents / 100)));
  const dirty = value !== String(Math.round(cents / 100));

  return (
    <li className="flex items-center gap-3 rounded-md border border-border px-3 py-2">
      <div className="flex-1">
        <div className="text-sm font-medium">{field.label}</div>
        <div className="text-xs text-muted-foreground">{field.help}</div>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-sm text-muted-foreground">$</span>
        <Input
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/[^\d]/g, ""))}
          className="w-24"
          aria-label={field.label}
        />
      </div>
      <Button
        type="button"
        size="sm"
        onClick={() => onSave(Math.round(Number(value || "0") * 100))}
        disabled={!dirty || saving}
      >
        Save
      </Button>
    </li>
  );
};

const FeesManager = () => {
  const pricing = usePricingConfig();
  const { setFee } = usePricingConfigMutations();

  return (
    <section className="space-y-4" aria-labelledby="fees-manager-heading">
      <div>
        <h2 id="fees-manager-heading" className="text-xl font-semibold">
          Fees
        </h2>
        <p className="text-sm text-muted-foreground">
          Flat fees applied across checkout and assessments, in whole dollars.
        </p>
      </div>

      <ul className="space-y-2">
        {FEE_FIELDS.map((field) => (
          <FeeRow
            key={field.key}
            field={field}
            cents={pricing.data?.[field.key] ?? PRICING_CONFIG_DEFAULTS[field.key]}
            saving={setFee.isPending}
            onSave={(cents) => setFee.mutate({ key: field.key, cents })}
          />
        ))}
      </ul>
    </section>
  );
};

export default FeesManager;
