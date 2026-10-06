import { useState, type ReactNode } from "react";
import { Calendar, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReviewBag } from "./RecommendationReview";
import type { PickupWindow } from "@/components/cobbli/PickupScheduler";

export type CheckoutDetails = { name: string; email: string; phone: string; street: string; street2: string; city: string; state: string; zip: string };
export function addressComplete(v: CheckoutDetails) {
  return !!v.street.trim() && !!v.city.trim() && /^[A-Za-z]{2}$/.test(v.state.trim()) && /^\d{5}$/.test(v.zip);
}
export function contactComplete(v: CheckoutDetails) {
  const phone = v.phone.replace(/\D/g, "");
  return !!v.name.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim()) && (phone.length === 10 || (phone.length === 11 && phone.startsWith("1")));
}
export default function RepairCheckout({ values, onChange, coverage, coverageError, onRetryCoverage, bags, selected, pickup, scheduler, busy, onConfirm, onEdit, savedAddress, onUseSavedAddress }: {
  values: CheckoutDetails; onChange: (key: keyof CheckoutDetails, value: string) => void;
  coverage: boolean | null; coverageError?: boolean; onRetryCoverage?: () => void;
  bags: ReviewBag[]; selected: Set<string>; pickup: PickupWindow | null; scheduler: ReactNode;
  busy?: boolean; onConfirm: () => void; onEdit: () => void;
  savedAddress?: string; onUseSavedAddress?: () => void;
}) {
  const [editEmail, setEditEmail] = useState(!values.email);
  const readyAddress = addressComplete(values) && coverage === true;
  const canConfirm = readyAddress && contactComplete(values) && !!pickup && bags.some(b => b.lines.some(l => selected.has(l.recommendation_id!)));
  const field = (key: keyof CheckoutDetails, label: string, placeholder = "", optional = false) => <label className="block text-sm text-primary" htmlFor={`checkout-${key}`}>{label}{!optional && <span aria-hidden="true"> *</span>}
    <input id={`checkout-${key}`} required={!optional} value={values[key]} placeholder={placeholder}
      type={key === "email" ? "email" : key === "phone" ? "tel" : "text"}
      autoComplete={({name:'name',email:'email',phone:'tel',street:'address-line1',street2:'address-line2',city:'address-level2',state:'address-level1',zip:'postal-code'})[key]}
      inputMode={key === 'zip' ? 'numeric' : undefined} maxLength={key === 'zip' ? 5 : key === 'state' ? 2 : 200}
      onChange={e => onChange(key, key === 'zip' ? e.target.value.replace(/\D/g,'').slice(0,5) : key === 'state' ? e.target.value.toUpperCase() : e.target.value)}
      className="mt-2 block h-11 w-full rounded-lg border border-border bg-white px-3 text-base focus-visible:outline-primary" />
  </label>;
  return <form onSubmit={e => { e.preventDefault(); if (canConfirm && !busy) onConfirm(); }} className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
    <fieldset disabled={busy} className="min-w-0 space-y-5">
      <section className="rounded-xl border border-border p-5 sm:p-6"><h2 className="mb-5 font-display text-2xl font-bold text-primary">1. Contact details</h2>
        <div className="space-y-5">{field('name','Full name')}
          <div>{editEmail ? field('email','Email address') : <><p className="text-sm text-primary">Email address</p><div className="mt-2 flex items-center gap-3"><p className="min-w-0 flex-1 break-all rounded-lg bg-stone-100 px-3 py-3 text-sm">{values.email}</p><button type="button" onClick={()=>setEditEmail(true)} className="shrink-0 text-sm underline">Change email</button></div></>}
            <p className="mt-2 text-xs text-muted-foreground">Repair updates will go to this email.{editEmail && ' This does not change your account email or sign-in.'}</p></div>
          <div>{field('phone','Mobile number','(212) 555-0123')}<p className="mt-2 text-xs text-muted-foreground">For coordinating pickup and return.</p></div>
        </div>
      </section>
      <section className="rounded-xl border border-border p-5 sm:p-6"><h2 className="mb-5 font-display text-2xl font-bold text-primary">2. Pickup address</h2>
        {savedAddress && <button type="button" onClick={onUseSavedAddress} className="mb-5 text-left text-sm underline">Use saved address: {savedAddress}</button>}
        <div className="space-y-5">{field('street','Street address','Street address')}
          <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-4">{field('street2','Apartment / unit','Optional',true)}{field('zip','ZIP code')}</div>
          {values.zip.length === 5 && <div aria-live="polite" className="text-sm">{coverageError ? <p role="alert">We couldn’t check this ZIP code. <button type="button" onClick={onRetryCoverage} className="underline">Try again</button></p> : coverage === null ? <p>Checking pickup availability…</p> : coverage ? <p className="text-green-800">✓ We offer pickup in this ZIP code.</p> : <p role="alert" className="text-destructive">We don’t offer pickup in this ZIP code yet. Enter another pickup address or <a className="underline" href="mailto:support@cobbli.com">contact us</a>.</p>}</div>}
          <div className="grid grid-cols-[minmax(0,1fr)_90px] gap-4">{field('city','City')}{field('state','State')}</div>
        </div>
      </section>
      <section className="rounded-xl border border-border p-5 sm:p-6"><h2 className="mb-4 font-display text-2xl font-bold text-primary">3. Choose a pickup time</h2>
        {readyAddress ? scheduler : <><p className="text-sm text-muted-foreground">Complete an eligible pickup address to see available times.</p><div className="mt-4 flex flex-col items-center gap-3 rounded-lg bg-[#fff8df] p-7 text-sm"><Calendar size={30} />Pickup windows will appear here.</div></>}
      </section>
    </fieldset>
    <aside className="min-w-0 rounded-xl border border-[#efdfb5] bg-[#fff8df] p-6 lg:sticky lg:top-32">
      <h2 className="font-display text-3xl font-bold text-primary">Your repair</h2>
      {bags.map(bag => { const work=bag.lines.filter(l=>selected.has(l.recommendation_id!)); return !work.length ? null : <section key={bag.id || bag.label} className="mt-5">
        <div className="mb-4 flex items-center gap-3"><div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg bg-[#f1eadb]">{bag.photo ? <img src={bag.photo} alt={bag.label} className="h-full w-full object-cover" /> : <ShoppingBag size={24} />}</div><h3 className="font-display text-xl font-bold">{bag.label}</h3></div>
        <ul className="divide-y divide-[#e6d8bc]">{work.map(line=><li key={line.recommendation_id} className="py-3"><div className="flex flex-wrap justify-between gap-2 text-sm"><span>{line.name}</span><span>Complimentary</span></div>{line.limitations && <p className="mt-1 text-xs text-muted-foreground">{line.limitations}</p>}</li>)}</ul>
      </section>; })}
      <button type="button" disabled={busy} onClick={onEdit} className="mt-3 text-sm underline">Edit repairs</button>
      <div className="mt-6 flex justify-between gap-3 border-y border-[#e6d8bc] py-5 text-sm"><span>Pickup &amp; return</span><span>Complimentary</span></div>
      <div className="mt-5 flex flex-wrap justify-between gap-2 font-display text-2xl font-bold"><span>Total</span><span>Complimentary</span></div>
      <p className="mt-3 text-sm text-muted-foreground">No payment required during our pilot.</p>
      <Button size="lg" type="submit" disabled={!canConfirm || busy} className="mt-6 w-full disabled:bg-stone-300 disabled:text-stone-600 disabled:opacity-100">{busy ? 'Confirming…' : 'Confirm repair'}</Button>
      {!canConfirm && <p className="mt-3 text-xs text-muted-foreground">Add your contact details, complete an eligible address, and choose a pickup time to confirm.</p>}
      <p className="mt-6 border-t border-[#e6d8bc] pt-5 text-xs text-muted-foreground">Return scheduling will be available when your repair is ready.</p>
    </aside>
  </form>;
}
