/**
 * BeforeAfterSlider
 *
 * Drag-to-compare before/after image slider. Extracted from the admin
 * Photos gallery (AdminDashboard.tsx's GalleryCard, built earlier this
 * project) into a shared component so the same interaction can be reused on
 * customer-facing surfaces (service/package cards, detail pages) once real
 * before/after photo pairs exist for those — right now services have one
 * representative photo and packages have none, so nothing customer-facing
 * calls this yet. Wiring it in later is a matter of passing two image URLs,
 * not rebuilding the interaction.
 *
 * Implementation notes (carried over from the admin version, unchanged):
 * a transparent, full-size `<input type="range">` sits on top of both images
 * and drives a CSS `clip-path` on the "before" image — no drag/pointer event
 * handling of our own, so it inherits the browser's native range-input
 * accessibility (keyboard arrows, touch, screen readers) for free.
 */

import { useState } from "react";

type Props = {
  beforeUrl: string;
  afterUrl: string;
  beforeAlt?: string;
  afterAlt?: string;
  beforeLabel?: string;
  afterLabel?: string;
  /** CSS aspect-ratio value, e.g. "4 / 3" or "4 / 5". */
  aspectRatio?: string;
  className?: string;
};

export default function BeforeAfterSlider({
  beforeUrl,
  afterUrl,
  beforeAlt = "Before",
  afterAlt = "After",
  beforeLabel = "Before",
  afterLabel = "After",
  aspectRatio = "4 / 3",
  className,
}: Props) {
  const [pos, setPos] = useState(50);

  return (
    <div
      className={className}
      style={{ position: "relative", width: "100%", aspectRatio, borderRadius: 6, overflow: "hidden", backgroundColor: "#f3f4f6" }}
    >
      <img src={afterUrl} alt={afterAlt} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      <img
        src={beforeUrl}
        alt={beforeAlt}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      />
      <div style={{ position: "absolute", top: 0, bottom: 0, left: `${pos}%`, width: 2, backgroundColor: "#fff", pointerEvents: "none", transform: "translateX(-1px)" }} />
      <input
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={e => setPos(Number(e.target.value))}
        aria-label={`Drag to compare ${beforeLabel.toLowerCase()} and ${afterLabel.toLowerCase()}`}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "ew-resize", margin: 0 }}
      />
      <span style={{ position: "absolute", top: 8, left: 8, fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 4, backgroundColor: "rgba(255,255,255,0.9)", color: "#3d1700", pointerEvents: "none" }}>
        {beforeLabel}
      </span>
      <span style={{ position: "absolute", top: 8, right: 8, fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 4, backgroundColor: "rgba(255,255,255,0.9)", color: "#3d1700", pointerEvents: "none" }}>
        {afterLabel}
      </span>
    </div>
  );
}
