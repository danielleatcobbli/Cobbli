// Returns a browser-renderable object URL for an image File.
// If the file is HEIC/HEIF, converts to JPEG client-side for preview only.
// The original File is NOT modified — callers continue to upload it unchanged.
export async function createPreviewUrl(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  const isHeic =
    type === "image/heic" ||
    type === "image/heif" ||
    name.endsWith(".heic") ||
    name.endsWith(".heif");

  if (!isHeic) return URL.createObjectURL(file);

  // Safari can render HEIC natively. Avoid unnecessary conversion (and
  // decoder failures) on browsers that already support the original photo.
  const nativeUrl = URL.createObjectURL(file);
  const supported = await new Promise<boolean>(resolve => {
    const image = new Image();
    const timer = window.setTimeout(() => resolve(false), 1500);
    image.onload = () => { window.clearTimeout(timer); resolve(true); };
    image.onerror = () => { window.clearTimeout(timer); resolve(false); };
    image.src = nativeUrl;
  });
  if (supported) return nativeUrl;
  URL.revokeObjectURL(nativeUrl);

  try {
    const { default: heic2any } = await import("heic2any");
    const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.8 });
    const blob = Array.isArray(out) ? out[0] : out;
    return URL.createObjectURL(blob as Blob);
  } catch (e) {
    console.error("HEIC preview conversion failed", e);
    throw new Error("Could not create a preview for this HEIC photo.");
  }
}
