import RepairCheckout, { type CheckoutDetails } from "@/components/cobbli/repair/RepairCheckout";
import type { PickupWindow } from "@/components/cobbli/PickupScheduler";
/** Development-only, synthetic data. Never sends messages or books appointments. */
import { useState } from "react";
import Header from "@/components/cobbli/Header";
import RecommendationReview from "@/components/cobbli/repair/RecommendationReview";
import RepairResponse from "@/components/cobbli/repair/RepairResponse";
import { initialRecommendationSelection, normalizeRecommendations, toggleRecommendation, type Recommendation } from "@/lib/recommendations";
import type { ResponseTransport } from "@/lib/repairResponse";
import { Button } from "@/components/ui/button";
const lines = normalizeRecommendations<Recommendation>([
  {service_id:'stitch',pair_id:'bag',name:'Stitch the existing handle',price_cents:0,tier:'essential',choice_group:'Handle',choice_group_label:'Repair the cracked handle',preferred:true,rationale:'Keeps the original material.',limitations:'Temporary fix — further cracking may occur.'},
  {service_id:'replace',pair_id:'bag',name:'Replace the handle',price_cents:0,tier:'essential',choice_group:'Handle',choice_group_label:'Repair the cracked handle',limitations:'Replacement material may differ from the original.'},
  {service_id:'seam',pair_id:'bag',name:'Reinforce the loose stitching',price_cents:0,tier:'recommended',rationale:'Strengthens the seam before it opens further.'},
  {service_id:'clean',pair_id:'bag',name:'Clean and condition the bag',price_cents:0,tier:'optional',rationale:'A refresh for its appearance and finish.'},
]);
const transport: ResponseTransport = {
  load:async()=>({id:'preview-question',pair_id:'bag',body:'Could you send a close-up of where the handle is cracked, plus a photo of the full handle? Also, would you prefer to keep the original material if possible?',created_at:'2026-10-06T14:30:00Z'}),
  send:async()=>({saved:true,response_id:'preview-only-not-sent'}),
};
export default function CustomerRepairPreview() {
  const [mode,setMode]=useState('recommendations');
  const [selected,setSelected]=useState(()=>initialRecommendationSelection(lines,null));
  const [pickup,setPickup]=useState(false);
  const [details,setDetails]=useState<CheckoutDetails>({name:'Alex Morgan',email:'alex@example.com',phone:'',street:'',street2:'',city:'New York',state:'NY',zip:'10001'});
  const [window,setWindow]=useState<PickupWindow | null>(null);
  const [confirmed,setConfirmed]=useState(false);
  return <main className="min-h-screen bg-white"><Header />
    <div className="bg-[#fff4d5] px-5 py-3 text-center text-sm">Design preview · Sample information only · Nothing is sent or booked
      <div className="mt-2 flex justify-center gap-4"><button className="underline" onClick={()=>setMode('recommendations')}>Recommendations screen</button><button className="underline" onClick={()=>setMode('response')}>Information request screen</button></div>
    </div>
    <section className="container max-w-6xl py-10 md:py-14">
      <p className="text-sm">Repair #PREVIEW <span className="ml-3 rounded-full bg-[#fff4d5] px-3 py-1">{mode==='response'?'More information needed':'Recommendations ready'}</span></p>
      <h1 className="mt-5 font-display text-3xl font-bold uppercase leading-tight text-primary sm:text-4xl lg:text-5xl">{mode==='response'?'A closer look, please':pickup?'Confirm your repair':'Review your recommendations'}</h1>
      <p className="mt-3 text-base text-muted-foreground sm:text-lg">{mode==='response'?'A little more detail will help us recommend the right fixes.':pickup?'Add your pickup details, choose a time, and you’re all set.':'We’ve selected our suggested repairs. Uncheck anything you’d like to skip.'}</p>
      {mode==='response' ? <RepairResponse transport={transport} bags={[{id:'bag',label:'Bag 1'}]} /> : pickup ? <RepairCheckout values={details} onChange={(key,value)=>{setDetails(prev=>({...prev,[key]:value})); if(['street','street2','city','state','zip'].includes(key))setWindow(null);}}
        coverage={details.zip.length===5 ? details.zip==='10001' : null} bags={[{id:'bag',label:'Bag 1',lines}]} selected={selected} pickup={window}
        scheduler={<div><p className="mb-3 text-sm">Sample pickup window — no real availability is being checked.</p><Button type="button" variant={window?'default':'outline'} onClick={()=>setWindow({start_time:'2099-10-10T14:00:00Z',end_time:'2099-10-10T15:30:00Z'})}>Saturday · 10:00–11:30 AM</Button></div>}
        onEdit={()=>setPickup(false)} onConfirm={()=>setConfirmed(true)} busy={false} /> : <RecommendationReview bags={[{id:'bag',label:'Bag 1',lines}]} selected={selected}
        onToggle={id=>setSelected(prev=>toggleRecommendation(lines,prev,id))} complimentary canContinue={selected.size>0}
        onContinue={()=>setPickup(true)} onEdit={()=>setPickup(false)} pickup={pickup ? <div><p>This preview does not fetch real appointments. On your request, this step shows the pickup address and available times.</p><Button className="mt-5" disabled>Confirm repair</Button></div>:undefined} />}
      {confirmed && <p role="status" className="mt-5 rounded-lg bg-[#fff8df] p-4">Preview complete. No repair or appointment was created.</p>}
    </section>
  </main>;
}
