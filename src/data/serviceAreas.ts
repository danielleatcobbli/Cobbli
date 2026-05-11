// Beta launch service area zip codes.
// In production this list will live in a Supabase service_areas table and be
// editable without a code change. For now it is mocked here.
export const SERVICE_AREA_ZIPS: ReadonlySet<string> = new Set([
  "10001", "10002", "10003", "10004", "10005", "10006", "10007",
  "10009", "10010", "10011", "10012", "10013", "10014", "10038",
  "10280", "10281", "10282",
]);

export const isServiceableZip = (zip: string) => SERVICE_AREA_ZIPS.has(zip.trim());
