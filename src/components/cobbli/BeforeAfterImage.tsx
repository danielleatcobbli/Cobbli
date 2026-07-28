import { useState, type CSSProperties } from "react";

type Props = {
  /** "Before" photo — shown by default. If not set, nothing renders. */
  before?: string;
  /** "After" photo — swaps in on hover/focus. Danielle's call (2026-07-22):
   *  most conditions/services don't have a real after photo yet, so this is
   *  a deliberate no-op (stays on `before`) until one is added — not a bug. */
  after?: string;
  alt: string;
  className?: string;
  style?: CSSProperties;
};

/** Drop-in replacement for a plain <img> anywhere a condition or service
 *  shows a representative photo (StartRepair.tsx checklist, ServiceCard.tsx)
 *  — same className/style API, just swaps to `after` on hover/focus when
 *  one exists. tabIndex is only added when there's actually an after photo
 *  to reveal, so keyboard users can reach the swap without every plain
 *  before-only photo becoming a tab stop. */
const BeforeAfterImage = ({ before, after, alt, className, style }: Props) => {
  const [showAfter, setShowAfter] = useState(false);
  if (!before) return null;

  return (
    <img
      src={showAfter ? after : before}
      alt={alt}
      className={className}
      style={style}
      tabIndex={after ? 0 : undefined}
      onMouseEnter={() => after && setShowAfter(true)}
      onMouseLeave={() => setShowAfter(false)}
      onFocus={() => after && setShowAfter(true)}
      onBlur={() => setShowAfter(false)}
    />
  );
};

export default BeforeAfterImage;
