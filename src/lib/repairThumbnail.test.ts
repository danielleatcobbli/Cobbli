import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ download: vi.fn(), sign: vi.fn(), preview: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { storage: { from: () => ({ download: mocks.download, createSignedUrl: mocks.sign }) } } }));
vi.mock("@/lib/heicPreview", () => ({ createPreviewUrl: mocks.preview }));
import { loadRepairThumbnail } from "./repairThumbnail";
beforeEach(() => vi.resetAllMocks());
describe("repair thumbnails", () => {
  it.each(["bag.HEIC", "bag.heif"])("converts a stored %s original for display", async name => {
    mocks.download.mockResolvedValue({ data: new Blob(["original"], { type: "image/heic" }), error: null });
    mocks.preview.mockResolvedValue("blob:preview");
    expect(await loadRepairThumbnail(`owner/${name}`)).toBe("blob:preview");
    expect(mocks.preview.mock.calls[0][0].name).toBe(name);
    expect(mocks.sign).not.toHaveBeenCalled();
  });
  it("uses a fresh signed URL for a PNG", async () => {
    mocks.sign.mockResolvedValue({ data: { signedUrl: "https://example.com/signed" }, error: null });
    expect(await loadRepairThumbnail("owner/bag.png")).toBe("https://example.com/signed");
    expect(mocks.download).not.toHaveBeenCalled();
  });
  it("keeps missing photos as placeholders", async () => {
    mocks.download.mockResolvedValue({ data: null, error: new Error("missing") });
    expect(await loadRepairThumbnail("owner/bag.heic")).toBeNull();
    expect(mocks.preview).not.toHaveBeenCalled();
  });
});
