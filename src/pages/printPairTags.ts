/**
 * printPairTags — triggers the browser's print dialog for one or more
 * per-pair intake tags, from the admin order detail page.
 *
 * Deliberately placeholder content, not the final tag design (2026-07-20,
 * Danielle's call): the visual design (colors, QR code, layout) is still
 * pending sign-off from Alex, so this only builds the *mechanism* — a
 * button that reliably prints the right number of tags with the right
 * underlying data — using plain, unstyled markup for now. Swap the HTML
 * built in buildTagHtml() for the final design once it's approved; nothing
 * else about how this is wired needs to change.
 *
 * How printing works here, and why: there's no way for a website to print
 * silently with zero clicks in any browser — that's a deliberate security
 * restriction everywhere, not something specific to this app. The closest
 * available approximation is what's built below: inject a hidden
 * print-only region into the page, hide everything else via a `@media
 * print` rule, and call window.print() — which hands off to the browser's
 * native print dialog, where the actual label printer gets selected. Each
 * pair renders on its own page (via `page-break-after`) so printing "all"
 * produces one tag per pair rather than everything crammed onto one.
 */

import type { ShoePair } from "./AdminOrderDetail";

const PRINT_AREA_ID = "pair-tag-print-area";
const PRINT_STYLE_ID = "pair-tag-print-style";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** One pair's tag, as plain placeholder markup — order #, pair index,
 * shoe description, service names, customer notes, and stand-ins for the
 * QR code and QC signoff line. Replace with the approved design later. */
function buildTagHtml(orderNumber: string, pair: ShoePair, pairIndex: number, totalPairs: number, isLastPage: boolean): string {
  const shoeLine = [pair.shoeBrand, pair.shoeColorMaterial].filter(Boolean).join(" · ") || pair.shoeType || "";
  const servicesHtml = pair.services.length
    ? pair.services.map((s) => `<li>${escapeHtml(s.name)}</li>`).join("")
    : `<li style="color:#999;">No services recorded</li>`;
  const notesHtml = pair.customerNotes
    ? `<div style="margin-top:10px;font-size:12px;"><strong>Notes:</strong> ${escapeHtml(pair.customerNotes)}</div>`
    : "";

  return `
    <div style="page-break-after: ${isLastPage ? "auto" : "always"}; padding: 24px; font-family: sans-serif; color: #111;">
      <div style="font-size: 11px; color: #666;">Order #${escapeHtml(orderNumber)}</div>
      <div style="font-size: 16px; font-weight: 700; margin: 2px 0 6px;">Pair ${pairIndex + 1} of ${totalPairs}</div>
      ${shoeLine ? `<div style="font-size: 13px; margin-bottom: 8px;">${escapeHtml(shoeLine)}</div>` : ""}
      <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #666; margin-top: 10px;">Services</div>
      <ul style="margin: 4px 0 0; padding-left: 18px; font-size: 13px;">${servicesHtml}</ul>
      ${notesHtml}
      <div style="margin-top: 18px; width: 72px; height: 72px; border: 1px dashed #999; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #999; text-align: center;">
        QR code<br/>placeholder
      </div>
      <div style="margin-top: 16px; font-size: 11px; color: #999;">QC: ______&nbsp;&nbsp;&nbsp;&nbsp;QC date: ______</div>
    </div>
  `;
}

/** Prints one tag per pair given. Pass a single-item array to reprint just
 * one pair, or the full order.pairs array to print every tag in the order
 * at once. */
export function printPairTags(orderNumber: string, pairs: ShoePair[]): void {
  if (pairs.length === 0) return;

  // Clean up any leftover print area from a previous call that didn't fire
  // its "afterprint" cleanup (e.g. the print dialog was dismissed in a way
  // the browser didn't report) before adding a new one.
  document.getElementById(PRINT_AREA_ID)?.remove();
  document.getElementById(PRINT_STYLE_ID)?.remove();

  const container = document.createElement("div");
  container.id = PRINT_AREA_ID;
  container.innerHTML = pairs
    .map((pair, i) => buildTagHtml(orderNumber, pair, i, pairs.length, i === pairs.length - 1))
    .join("");

  const style = document.createElement("style");
  style.id = PRINT_STYLE_ID;
  style.textContent = `
    #${PRINT_AREA_ID} { display: none; }
    @media print {
      body > *:not(#${PRINT_AREA_ID}) { display: none !important; }
      #${PRINT_AREA_ID} { display: block !important; }
    }
  `;

  document.body.appendChild(style);
  document.body.appendChild(container);

  const cleanup = () => {
    container.remove();
    style.remove();
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);

  window.print();
}
