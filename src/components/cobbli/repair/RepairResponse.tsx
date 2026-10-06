import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Plus, ShoppingBag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CustomerQuestion, ResponseTransport } from "@/lib/repairResponse";

const MAX_FILES = 6;
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
export default function RepairResponse({ transport, bags }: {
  transport: ResponseTransport; bags: { id?: string; label: string; photo?: string }[];
}) {
  const [question, setQuestion] = useState<CustomerQuestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [reply, setReply] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const submissionId = useRef<string | null>(null);
  const sendingRef = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let active = true;
    setLoading(true); setLoadError(false);
    transport.load().then(data => {
      if (!data?.id || !data.body?.trim()) throw new Error("Missing customer question");
      if (active) { setQuestion(data); setSent(Boolean(data.response_received)); }
    }).catch(() => { if (active) setLoadError(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [transport, attempt]);
  useEffect(() => {
    const urls = files.map(file => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach(url => URL.revokeObjectURL(url));
  }, [files]);
  const addFiles = (incoming: File[]) => {
    setError("");
    if (files.length + incoming.length > MAX_FILES) { setError("Please add no more than 6 photos."); return; }
    if (incoming.some(f => !ALLOWED.includes(f.type) || f.size > MAX_BYTES || !f.size)) {
      setError("Please choose JPG, PNG, or WebP photos under 10 MB each."); return;
    }
    setFiles(prev => [...prev, ...incoming]); submissionId.current = null;
  };
  const submit = async () => {
    if (!question || sendingRef.current || sent || (!reply.trim() && files.length === 0)) return;
    sendingRef.current = true; setSending(true); setError("");
    submissionId.current ||= crypto.randomUUID();
    try {
      const receipt = await transport.send(question.id, reply.trim(), files, submissionId.current);
      if (!receipt?.saved || !receipt.response_id) throw new Error("No receipt");
      setSent(true); setReply(""); setFiles([]);
    } catch { setError("We couldn’t confirm your response was saved. Your reply and photos are still here. Please try again."); }
    finally { sendingRef.current = false; setSending(false); }
  };
  const visibleBags = question?.pair_id ? bags.filter(b => b.id === question.pair_id) : bags;
  return <div className="mt-8 max-w-4xl">
    <div className="mb-6 flex flex-wrap gap-5">{visibleBags.map(bag => <div key={bag.id || bag.label} className="flex items-center gap-3">
      <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg bg-[#f5f0e8]">{bag.photo ? <img src={bag.photo} alt={bag.label} className="h-full w-full object-cover" /> : <ShoppingBag className="text-primary/50" />}</div><span className="font-medium text-primary">{bag.label}</span>
    </div>)}</div>
    {loading ? <p role="status">Loading Cobbli’s question…</p> : loadError ? <section className="rounded-xl border p-6">
      <p role="alert">We couldn’t load Cobbli’s question. Please try again or email us for help.</p>
      <div className="mt-4 flex gap-4 items-center"><Button onClick={() => setAttempt(n => n + 1)} variant="outline">Try again</Button><a href="mailto:support@cobbli.com" className="underline">Email Cobbli</a></div>
    </section> : sent ? <section className="rounded-xl border bg-[#fff8df] p-7" role="status">
      <CheckCircle2 className="mb-3 text-primary" /><h2 className="font-display text-2xl font-semibold">Response sent</h2><p className="mt-2">Thank you. We’ll review your reply and follow up with next steps.</p>
    </section> : question && <form onSubmit={e => { e.preventDefault(); void submit(); }} className="rounded-xl border border-border p-5 sm:p-7">
      <div className="flex flex-wrap justify-between gap-2"><h2 className="font-semibold text-primary">A note from Cobbli</h2><time className="text-xs text-muted-foreground" dateTime={question.created_at}>{Number.isNaN(Date.parse(question.created_at)) ? "" : new Date(question.created_at).toLocaleDateString("en-US", {month:"short",day:"numeric"})}</time></div>
      <p className="mt-3 whitespace-pre-wrap leading-relaxed text-primary">{question.body}</p>
      {!!question.attachments?.length && <div className="mt-4 flex flex-wrap gap-3">{question.attachments.map((a, i) => <a key={i} href={a.url} target="_blank" rel="noreferrer"><img src={a.url} alt={a.alt || `Photo from Cobbli ${i + 1}`} className="h-24 w-24 rounded-lg object-cover" /></a>)}</div>}
      <fieldset disabled={sending} className="mt-6 border-t pt-5">
        <label htmlFor="repair-reply" className="font-semibold text-primary">Your reply</label>
        <textarea id="repair-reply" placeholder="Tell us a little more…" maxLength={4000} value={reply}
          onChange={e => { setReply(e.target.value); submissionId.current = null; }} className="mt-2 min-h-32 w-full rounded-lg border border-border bg-white p-3 text-base focus-visible:outline-primary" />
        <p className="mt-5 font-semibold text-primary">Add photos</p>
        <input ref={input} aria-label="Choose photos" type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={e => { addFiles(Array.from(e.target.files || [])); e.target.value = ""; }} />
        <button type="button" onClick={() => input.current?.click()} className="mt-2 flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border px-4 py-7 hover:bg-[#fffaf0]">
          <Plus className="rounded-full bg-[#fff2cc] p-1" size={30} /><span className="font-medium">Upload photos</span><span className="text-xs text-muted-foreground">JPG, PNG or WebP · Up to 6 photos · 10 MB each</span>
        </button>
        {files.length > 0 && <div className="mt-4"><p className="text-sm">{files.length} {files.length === 1 ? "photo" : "photos"} added</p><div className="mt-2 flex flex-wrap gap-3">{files.map((file, i) => <div key={`${file.name}-${i}`} className="relative"><img src={previews[i]} alt={`Attached photo ${i + 1}`} className="h-24 w-24 rounded-lg object-cover" /><button type="button" aria-label={`Remove photo ${i + 1}`} onClick={() => { setFiles(prev => prev.filter((_, n) => n !== i)); submissionId.current = null; }} className="absolute right-1 top-1 rounded-full bg-white p-1 shadow"><X size={16} /></button></div>)}</div></div>}
        {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
        <div className="mt-6 flex flex-col gap-4 border-t pt-5 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-muted-foreground">Add a reply or photos, then send them to Cobbli.</p><Button type="submit" size="lg" disabled={sending || (!reply.trim() && files.length === 0)} className="disabled:bg-stone-300 disabled:text-stone-600 disabled:opacity-100">{sending ? "Sending…" : "Send response"}</Button></div>
      </fieldset>
    </form>}
  </div>;
}
