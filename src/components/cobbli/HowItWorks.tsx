import { Camera, HandPointer, House } from "lucide-react";
const steps = [
  { title: "Show us your bag", Icon: Camera, copy: "Upload a few photos and we'll recommend the right fixes." },
  { title: "Schedule a pickup", Icon: HandPointer, copy: "We'll email you when your recommendations are ready. Choose the repairs you'd like and schedule a pickup." },
  { title: "We’ll take care of the rest", Icon: House, copy: "We pick up your bag and our expert artisans repair it. When it’s ready, we’ll contact you to arrange its return." },
];
export default function HowItWorks() {
  return <section id="how-it-works" className="py-16 md:py-20" style={{ backgroundColor: "#fdb600" }}>
    <div className="container">
      <h2 className="text-center text-5xl md:text-7xl uppercase mb-10" style={{ color: "#fff5cc", fontFamily: "'Fraunces', serif" }}>How it <em>works</em></h2>
      <ol className="grid gap-5 md:grid-cols-3">{steps.map(({ title, Icon, copy }, index) => <li key={title} className="rounded-xl p-7 md:p-9" style={{ backgroundColor: "#fff5cc", color: "#3d1700" }}>
        <span className="text-sm font-semibold">0{index + 1}</span>
        <Icon size={64} strokeWidth={1.3} className="my-7" aria-hidden="true" />
        <h3 className="text-2xl mb-3">{title}</h3><p className="leading-relaxed">{copy}</p>
      </li>)}</ol>
    </div>
  </section>;
}
