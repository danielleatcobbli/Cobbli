import CloseRepair from "./CloseRepair";
import { useState } from "react";
import { apiFetchJson } from "@/integrations/api/client";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type Message = { id: string; body: string; response?: { body: string; photos: string[] } | null };
export default function RepairMessages({ assessmentId, onSaved }: { assessmentId: string; onSaved?: () => void }) {
  const [action, setAction] = useState<"question" | "decline" | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [history, setHistory] = useState<Message[] | null>(null);
  const perform = async (ready = false) => {
    setBusy(true); setNotice("");
    try {
      if (ready) {
        const { error } = await supabase.rpc("mark_quote_ready", { _assessment_id: assessmentId });
        if (error) throw error;
      } else {
        await apiFetchJson(`/ops/assessments/${assessmentId}/message`, {
          method: "POST", body: JSON.stringify({ action, message }),
        });
      }
      setNotice("Saved. Customer notification queued."); setMessage(""); setAction(null); onSaved?.();
    } catch (e) { setNotice(e instanceof Error ? e.message : "Could not save. Please try again."); }
    finally { setBusy(false); }
  };
  const loadHistory = async () => {
    setBusy(true); setNotice("");
    try { setHistory((await apiFetchJson<{data: Message[]}>(`/ops/assessments/${assessmentId}/messages`)).data); }
    catch { setNotice("Could not load customer replies."); }
    finally { setBusy(false); }
  };
  return <div className="space-y-2 max-w-lg">
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" disabled={busy} onClick={() => void perform(true)}>Mark ready</Button>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => setAction("question")}>Ask a question</Button>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => setAction("decline")}>Decline</Button>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => void loadHistory()}>Customer replies</Button>
    </div>
    {action && <form className="rounded border p-3 bg-white" onSubmit={e => {e.preventDefault(); void perform();}}>
      <label className="block text-sm font-medium">{action === "question" ? "Question for the customer" : "Explain why we cannot take on this request"}
        <textarea required maxLength={4000} value={message} onChange={e => setMessage(e.target.value)} className="block mt-2 w-full border rounded p-2 min-h-24" />
      </label>
      <div className="mt-2 flex gap-2"><Button size="sm" disabled={busy || !message.trim()}>{busy ? "Saving…" : action === "question" ? "Send question" : "Confirm decline"}</Button><Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setAction(null)}>Cancel</Button></div>
    </form>}
    <CloseRepair id={assessmentId} request onSaved={onSaved} />
    {notice && <p role="status" className="text-sm">{notice}</p>}
    {history && <section className="space-y-3 rounded border p-3 bg-white">
      <div className="flex justify-between"><strong>Conversation</strong><button onClick={() => setHistory(null)}>Close</button></div>
      {!history.length && <p>No questions yet.</p>}
      {history.map(q => <div key={q.id} className="border-t pt-2 text-sm"><p className="whitespace-pre-wrap"><strong>Cobbli:</strong> {q.body}</p>
        {q.response ? <><p className="mt-2 whitespace-pre-wrap"><strong>Customer:</strong> {q.response.body}</p><div className="flex gap-2 flex-wrap">{q.response.photos.filter(Boolean).map(url => <a key={url} href={url} target="_blank" rel="noreferrer"><img src={url} alt="Customer attachment" className="w-24 h-24 object-cover" /></a>)}</div></> : <p className="text-muted-foreground mt-2">Awaiting a response.</p>}
      </div>)}
    </section>}
  </div>;
}
