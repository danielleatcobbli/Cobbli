/**
 * Sales tax calculation for checkout order summaries.
 *
 * Cobbli currently only services New York, where repair services (labor, not
 * a tangible good) are sales-tax-exempt — see cobbli-requirements.md section
 * 11. As service expands to other states, add each state's rate/rule here.
 * Danielle will provide the calculation for each new state as it's added;
 * until then, every state resolves to $0 rather than guessing a rate.
 */
export function calculateTaxCents(
  state: string | null | undefined,
  _subtotalCents: number,
): number {
  switch (state) {
    case "NY":
    default:
      return 0;
  }
}
