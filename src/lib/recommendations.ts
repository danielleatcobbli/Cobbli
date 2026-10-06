export type Recommendation = {
  recommendation_id?: string; service_id: string; pair_id?: string; name: string;
  price_cents: number; choice_group?: string; rationale?: string; limitations?: string;
  tier?: "essential" | "recommended" | "optional";
  preferred?: boolean;
  choice_group_label?: string;
};
export function recommendationGroups(lines: Recommendation[]) {
  const groups = new Map<string, Recommendation[]>();
  for (const line of lines) {
    const key = line.choice_group
      ? JSON.stringify([line.pair_id || "", line.choice_group])
      : `line:${line.recommendation_id}`;
    groups.set(key, [...(groups.get(key) || []), line]);
  }
  const rank = { essential: 0, recommended: 1, optional: 2 };
  return [...groups.values()].sort((a, b) => rank[a[0].tier || "recommended"] - rank[b[0].tier || "recommended"]);
}
/** Preselection is a draft, never approval. One alternative per problem/bag. */
export function initialRecommendationSelection(lines: Recommendation[], saved: Set<string> | null) {
  const selected = new Set<string>();
  for (const options of recommendationGroups(lines)) {
    const choice = saved !== null
      ? options.find(line => saved.has(line.recommendation_id!))
      : options.find(line => line.preferred) || options[0];
    if (choice?.recommendation_id) selected.add(choice.recommendation_id);
  }
  return selected;
}
export const recommendationKey = (line: Recommendation, index: number) =>
  line.recommendation_id || `${line.pair_id || "legacy"}:${line.service_id}:${index}`;
export const normalizeRecommendations = <T extends Recommendation>(lines: T[]) =>
  lines.map((line, index) => ({ ...line, recommendation_id: recommendationKey(line, index) }));
export function toggleRecommendation(lines: Recommendation[], selected: Set<string>, id: string) {
  const next = new Set(selected);
  if (next.has(id)) { next.delete(id); return next; }
  const line = lines.find(l => l.recommendation_id === id);
  if (!line) return next;
  if (line.choice_group) for (const other of lines) {
    if (other.pair_id === line.pair_id && other.choice_group === line.choice_group && other.recommendation_id)
      next.delete(other.recommendation_id);
  }
  next.add(id);
  return next;
}
