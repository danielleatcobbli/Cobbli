import { useState } from "react";
import { apiFetchJson } from "@/integrations/api/client";
import { Button } from "@/components/ui/button";
export default function CloseRepair({ id, request = false, onSaved }: { id: string; request?: boolean; onSaved?: () => void }) {
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const [steps, setSteps] = useState("");
  const [payment, setPayment] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const save = async () => {
    setBusy(true); setNotice("");
    try {
      await apiFetchJson(request ? `/ops/assessments/${id}/close` : `/ops/repairs/${id}/cancel`, {
        method: "POST", body: JSON.stringify({ payment_status: payment, next_steps: steps, customer_requested: checked, bookings_canceled: checked }),
      });
      setOpen(false); setNotice("Saved. Customer notification queued."); onSaved?.();
    } catch(e) { setNotice(e instanceof Error ? e.message : "Could not save."); }
    finally { setBusy(false); }
  };
  return <div className="text-sm mt-3">
    <Button size="sm" variant="outline" onClick={() => setOpen(!open)}>{request ? "Close at customer's request" : "Cancel repair"}</Button>
    {open && <form className="mt-3 p-4 border rounded space-y-3 max-w-lg" onSubmit={e => {e.preventDefault(); void save();}}>
      {!request && <label className="block">Next steps for the customer<textarea required maxLength={4000} className="block border rounded p-2 w-full" value={steps} onChange={e => setSteps(e.target.value)} /></label>}
      <label className="block">Payment/refund status {request && "(if applicable)"}<textarea required={!request} maxLength={4000} className="block border rounded p-2 w-full" value={payment} onChange={e => setPayment(e.target.value)} /></label>
      <label className="flex gap-2"><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} />{request ? "The customer asked us to close this request." : "I have canceled any outstanding calendar bookings and verified the payment status above."}</label>
      {!request && <p>This records the cancellation and notifies the customer. It does not cancel calendar bookings or issue a refund.</p>}
      <Button disabled={busy || !checked}>{busy ? "Saving…" : "Confirm"}</Button>
    </form>}
    {notice && <p role="status">{notice}</p>}
  </div>;
}
