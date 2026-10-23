import { supabase } from "@/integrations/supabase/client";
import { createPreviewUrl } from "@/lib/heicPreview";

// Originals remain in private storage. HEIC needs a browser-compatible preview
// when revisiting a repair, just as it does during the initial upload.
export async function loadRepairThumbnail(path: string): Promise<string | null> {
  const bucket = supabase.storage.from("assessment-uploads");
  if (/\.hei[cf]$/i.test(path)) {
    const { data, error } = await bucket.download(path);
    if (error || !data) return null;
    return createPreviewUrl(new File([data], path.split("/").pop()!, { type: data.type }));
  }
  const { data, error } = await bucket.createSignedUrl(path, 3600);
  return error ? null : data?.signedUrl ?? null;
}
