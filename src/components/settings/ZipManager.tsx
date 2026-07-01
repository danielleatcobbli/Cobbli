import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useServiceAreaMutations } from "@/hooks/useServiceAreaMutations";

type ServiceAreaRow = { zip: string; label: string | null; is_active: boolean };

const fetchAllServiceAreas = async (): Promise<ServiceAreaRow[]> => {
  const { data, error } = await supabase
    .from("service_areas")
    .select("zip, label, is_active")
    .order("zip");
  if (error) throw error;
  return (data ?? []) as ServiceAreaRow[];
};

const ZipManager = () => {
  const { data: zips, isLoading, error } = useQuery({
    queryKey: ["service-areas", "all"],
    queryFn: fetchAllServiceAreas,
  });
  const { addZip, removeZip } = useServiceAreaMutations();
  const [newZip, setNewZip] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const onAdd = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      await addZip.mutateAsync(newZip);
      setNewZip("");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not add ZIP.");
    }
  };

  return (
    <section className="space-y-4" aria-labelledby="zip-manager-heading">
      <div>
        <h2 id="zip-manager-heading" className="text-xl font-semibold">
          Serviced ZIP codes
        </h2>
        <p className="text-sm text-muted-foreground">
          Addresses in these ZIP codes can check out. Changes take effect immediately.
        </p>
      </div>

      <form onSubmit={onAdd} className="flex items-end gap-3" noValidate>
        <div className="space-y-2">
          <Label htmlFor="new-zip">Add a ZIP code</Label>
          <Input
            id="new-zip"
            inputMode="numeric"
            maxLength={5}
            value={newZip}
            onChange={(e) => setNewZip(e.target.value.replace(/\D/g, ""))}
            placeholder="10001"
            className="w-32"
          />
        </div>
        <Button type="submit" disabled={addZip.isPending || newZip.length !== 5}>
          {addZip.isPending ? "Adding…" : "Add"}
        </Button>
      </form>
      {formError && <p className="text-sm text-destructive">{formError}</p>}

      {isLoading && <p className="text-sm text-muted-foreground">Loading ZIP codes…</p>}
      {error && <p className="text-sm text-destructive">Could not load ZIP codes.</p>}

      {zips && (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {zips.map((z) => (
            <li
              key={z.zip}
              className="flex items-center justify-between rounded-md border border-border px-3 py-2"
            >
              <span className="font-mono text-sm">{z.zip}</span>
              <button
                type="button"
                onClick={() => removeZip.mutate(z.zip)}
                disabled={removeZip.isPending}
                className="text-sm text-destructive hover:underline disabled:opacity-50"
                aria-label={`Remove ${z.zip}`}
              >
                Remove
              </button>
            </li>
          ))}
          {zips.length === 0 && (
            <li className="col-span-full text-sm text-muted-foreground">
              No serviced ZIP codes yet.
            </li>
          )}
        </ul>
      )}
    </section>
  );
};

export default ZipManager;
