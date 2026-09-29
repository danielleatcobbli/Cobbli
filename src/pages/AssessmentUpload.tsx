import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Plus, X, Camera, Upload, Trash2 } from "lucide-react";
import Header from "@/components/cobbli/Header";
import Footer from "@/components/cobbli/Footer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { createPreviewUrl } from "@/lib/heicPreview";
import { useServiceableZips } from "@/hooks/useServiceableZips";

// Requires at least 2 characters after the last dot (e.g. "gmail.co" but not
// "gmail.c") — still permissive about actual domain names, just catches
// obviously-truncated/mistyped addresses (Danielle's call, 2026-07-30).
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const MAX_FILES = 10;
const MAX_SIZE = 50 * 1024 * 1024;
const MAX_ITEMS = 10;
const IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/heic", "image/heif"];
// Video removed from intake (2026-09-24, Danielle's call: "I feel like what
// we really want here are pictures") — this page is photos-only now.
const ACCEPT = "image/jpeg,image/png,image/heic,image/heif,.jpg,.jpeg,.png,.heic,.heif";

// Multiple items per submission (2026-09-24, Danielle's call: "I'm realizing
// there might be scenarios where someone has more than one thing to
// submit"). Each Picked now carries its own uploadPromise, kicked off the
// moment it's picked — this lets each ItemUploadCard instance manage its own
// file list/UI locally while the parent just awaits every item's promises at
// submit time, with no shared File->upload lookup map needed across items.
type Picked = { file: File; preview: string; uploadPromise: Promise<string> };

type Item = { key: string; files: Picked[]; description: string };

const isImage = (f: File) => {
  const ext = f.name.toLowerCase().split(".").pop() || "";
  return IMAGE_TYPES.includes(f.type) || ["jpg", "jpeg", "png", "heic", "heif"].includes(ext);
};

const genKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

/** One item's photo picker + description — everything an "Add another item"
 *  click needs a fresh, independent copy of (its own drag state, its own
 *  hidden file inputs). Upload orchestration (storage path/folder naming)
 *  stays with the parent via `startUpload`, passed in as a prop, so every
 *  item shares the same guest/user folder + session timestamp logic instead
 *  of each reinventing it. */
const ItemUploadCard = ({
  item,
  index,
  total,
  onFilesChange,
  onDescriptionChange,
  onRemove,
  startUpload,
}: {
  item: Item;
  index: number;
  total: number;
  onFilesChange: (files: Picked[]) => void;
  onDescriptionChange: (description: string) => void;
  onRemove: () => void;
  startUpload: (file: File) => Promise<string>;
}) => {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraPhotoInputRef = useRef<HTMLInputElement>(null);
  const files = item.files;

  const onPick = (list: FileList | null) => {
    if (!list) return;
    const incoming = Array.from(list);
    const accepted: Picked[] = [];
    for (const f of incoming) {
      if (!isImage(f)) {
        toast({ title: "Unsupported file", description: `${f.name} must be JPG, PNG or HEIC.`, variant: "destructive" });
        continue;
      }
      if (f.size > MAX_SIZE) {
        toast({ title: "File too large", description: `${f.name} exceeds 50MB.`, variant: "destructive" });
        continue;
      }
      const uploadPromise = startUpload(f).catch((e) => {
        console.warn("upload failed", e);
        throw e;
      });
      const picked: Picked = { file: f, preview: URL.createObjectURL(f), uploadPromise };
      accepted.push(picked);
      const name = f.name.toLowerCase();
      const isHeic =
        f.type === "image/heic" ||
        f.type === "image/heif" ||
        name.endsWith(".heic") ||
        name.endsWith(".heif");
      if (isHeic) {
        createPreviewUrl(f).then((url) => {
          onFilesChange(
            item.files.map((p) => {
              if (p.file !== f) return p;
              URL.revokeObjectURL(p.preview);
              return { ...p, preview: url };
            }),
          );
        });
      }
    }
    const remaining = MAX_FILES - files.length;
    if (accepted.length > remaining) {
      toast({ title: "File limit", description: `You can upload up to ${MAX_FILES} files.`, variant: "destructive" });
    }
    const added = accepted.slice(0, remaining);
    onFilesChange([...files, ...added]);
    if (inputRef.current) inputRef.current.value = "";
    if (cameraPhotoInputRef.current) cameraPhotoInputRef.current.value = "";
  };

  const remove = (idx: number) => {
    const next = [...files];
    const [gone] = next.splice(idx, 1);
    if (gone) URL.revokeObjectURL(gone.preview);
    onFilesChange(next);
  };

  return (
    <div className="mt-6 rounded-xl border border-border p-4 md:p-5">
      {/* Eyebrow only shown once there's more than one item — a single
          submission doesn't need "Item 1" disambiguation (2026-09-24,
          Danielle's call: don't make customers name things, so this is just
          an ordinal, not an identity). */}
      {total > 1 && (
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#3d1700" }}>
            Item {index + 1}
          </p>
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2 size={13} /> Remove
          </button>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => onPick(e.target.files)}
      />
      <input
        ref={cameraPhotoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => onPick(e.target.files)}
      />

      {files.length === 0 ? (
        <>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = "copy"; setDragOver(true); }}
            onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragOver(false);
              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                onPick(e.dataTransfer.files);
              }
            }}
            className={`hidden w-full rounded-xl border-2 border-dashed p-8 text-center transition-colors md:block ${
              dragOver
                ? "border-primary bg-secondary/60"
                : "border-border hover:border-primary/60 hover:bg-secondary/40"
            }`}
          >
            <Plus className="mx-auto mb-2" />
            <p className="font-medium text-primary">
              {dragOver ? (
                "Drop files to upload"
              ) : (
                <>
                  Upload photos <span className="text-destructive">*</span>
                </>
              )}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              JPG, PNG, HEIC · up to {MAX_FILES} files · 50MB max each
            </p>
          </button>

          <div className="grid grid-cols-2 gap-2 md:hidden">
            <button
              type="button"
              onClick={() => cameraPhotoInputRef.current?.click()}
              className="flex flex-col items-center gap-1.5 rounded-xl border border-border p-4 text-center hover:border-primary/60 hover:bg-secondary/40 transition-colors"
            >
              <Camera size={22} className="text-primary" />
              <span className="text-xs font-medium text-primary">Take photo</span>
            </button>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex flex-col items-center gap-1.5 rounded-xl border border-border p-4 text-center hover:border-primary/60 hover:bg-secondary/40 transition-colors"
            >
              <Upload size={22} className="text-primary" />
              <span className="text-xs font-medium text-primary">Choose from library</span>
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground md:hidden">
            JPG, PNG, HEIC · up to {MAX_FILES} files · 50MB max each
          </p>
        </>
      ) : (
        <>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {files.map((f, idx) => (
              <div key={idx} className="relative aspect-square rounded-md overflow-hidden border border-border bg-secondary/40">
                <img src={f.preview} alt={`Upload ${idx + 1}`} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => remove(idx)}
                  aria-label={`Remove file ${idx + 1}`}
                  className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            {files.length < MAX_FILES && (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = "copy"; setDragOver(true); }}
                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragOver(false);
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    onPick(e.dataTransfer.files);
                  }
                }}
                aria-label="Add more photos"
                className={`aspect-square rounded-md border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-colors ${
                  dragOver
                    ? "border-primary bg-secondary/60"
                    : "border-border hover:border-primary/60 hover:bg-secondary/40"
                }`}
              >
                <Plus size={20} className="text-primary" />
                <span className="text-[11px] font-medium text-primary">Add more</span>
              </button>
            )}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 md:hidden">
            {files.length < MAX_FILES && (
              <>
                <button
                  type="button"
                  onClick={() => cameraPhotoInputRef.current?.click()}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-border p-3 text-center hover:border-primary/60 hover:bg-secondary/40 transition-colors"
                >
                  <Camera size={20} className="text-primary" />
                  <span className="text-xs font-medium text-primary">Take photo</span>
                </button>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-border p-3 text-center hover:border-primary/60 hover:bg-secondary/40 transition-colors"
                >
                  <Upload size={20} className="text-primary" />
                  <span className="text-xs font-medium text-primary">Choose from library</span>
                </button>
              </>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {files.length} of {MAX_FILES} photos · 50MB max each
          </p>
        </>
      )}

      <div className="mt-4 space-y-2">
        <Label
          htmlFor={`item-description-${item.key}`}
          className="text-sm font-medium"
          style={{ color: "#3d1700" }}
        >
          What's going on with this bag?
        </Label>
        <Textarea
          id={`item-description-${item.key}`}
          value={item.description}
          onChange={(e) => onDescriptionChange(e.target.value.slice(0, 1000))}
          maxLength={1000}
          rows={3}
        />
      </div>
    </div>
  );
};

const AssessmentUpload = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  // Conditions the customer had already checked on the Start a Repair
  // checklist before clicking "Not sure? Send us a photo instead" (Danielle's
  // ask, 2026-09-01) — passed as router state from StartRepair.tsx and its
  // follow-up dialogs, so staff can see what the customer thinks they need
  // even though they never finished the checklist. Read once on mount;
  // StartRepair.tsx is the only place that ever sets this. Applies to the
  // whole submission, not any one item, since it comes from a pre-photo step.
  const requestedConditions = useState<string[]>(() => {
    const state = location.state as { requestedConditions?: string[] } | null;
    return Array.isArray(state?.requestedConditions) ? state.requestedConditions : [];
  })[0];
  const { isServiceable } = useServiceableZips();
  const [items, setItems] = useState<Item[]>([{ key: genKey(), files: [], description: "" }]);
  const [zip, setZip] = useState("");
  const [email, setEmail] = useState(user?.email ?? "");
  const [busy, setBusy] = useState(false);
  const sessionTsRef = useRef<string>("");

  usePageMeta({
    title: "Start a repair — Cobbli",
    description: "Upload photos of your bag and Cobbli's cobblers will recommend the right repairs.",
  });

  useEffect(() => {
    if (user?.email) setEmail(user.email);
  }, [user?.email]);

  useEffect(() => {
    return () => items.forEach((it) => it.files.forEach((f) => URL.revokeObjectURL(f.preview)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Shared upload orchestration — every item's ItemUploadCard calls this
  // rather than reimplementing folder/session-naming itself, so all photos
  // in one submission land under the same guest/user folder + timestamp.
  const startUpload = (file: File): Promise<string> => {
    if (!sessionTsRef.current) sessionTsRef.current = Date.now().toString();
    const ts = sessionTsRef.current;
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const folder = user ? user.id : `guest/${ts}`;
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    return supabase.storage
      .from("assessment-uploads")
      .upload(path, file, { contentType: file.type || undefined, upsert: false })
      .then(({ error }) => {
        if (error) throw error;
        return path;
      });
  };

  const updateItemFiles = (key: string, files: Picked[]) =>
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, files } : it)));
  const updateItemDescription = (key: string, description: string) =>
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, description } : it)));
  const addItem = () => {
    if (items.length >= MAX_ITEMS) return;
    setItems((prev) => [...prev, { key: genKey(), files: [], description: "" }]);
  };
  const removeItem = (key: string) =>
    setItems((prev) => {
      const gone = prev.find((it) => it.key === key);
      gone?.files.forEach((f) => URL.revokeObjectURL(f.preview));
      const next = prev.filter((it) => it.key !== key);
      // Never leave zero items — collapse to a single empty one instead.
      return next.length > 0 ? next : [{ key: genKey(), files: [], description: "" }];
    });

  const emailValid = emailRegex.test(email.trim());
  // Only flag as invalid on a definitive "not serviceable" (false) — never
  // while the zip list is still loading (null), same pattern as Checkout.tsx,
  // so a valid zip never gets false-failed while service_areas is fetching.
  const zipInvalid = zip.length === 5 && isServiceable(zip) === false;
  const zipValid = /^\d{5}$/.test(zip) && isServiceable(zip) !== false;
  // Every item on the page has to have at least one photo — an item with
  // zero photos isn't a real submission and there's nothing to review, so
  // rather than silently dropping it at submit time this blocks submit
  // until it's either filled in or removed (via the item's own Remove
  // button).
  const itemsValid = items.every((it) => it.files.length > 0);
  const canSubmit = items.length > 0 && itemsValid && emailValid && zipValid && !busy;

  /** Danielle's call (2026-07-28): drop the separate "confirm your shoe
   *  details" step entirely — shoe type/color/brand aren't asked for here.
   *  Brand still matters for exact resole pricing, but that gets collected
   *  later (at proposal/pricing time) rather than up front; asking for it
   *  here just adds friction to a step that's only "send us photos."
   *
   *  AI photo analysis is OFF for now (2026-07-29, Danielle's call) — we're
   *  not running the AI photo flow at the moment, just storing the raw
   *  upload. shoeType/colors/brand are left null/empty rather than inferred.
   *
   *  Multiple items per submission (2026-09-24, Danielle's call) — each
   *  item on the page becomes its own entry in the `pairs` jsonb array,
   *  carrying its own photoPaths + description. Danielle explicitly didn't
   *  want customers asked to name/label each item, so there's no "item
   *  name" field anywhere here — downstream (AssessmentProposal.tsx,
   *  Admin.tsx, the Bag/Checkout flow) each item is identified visually by
   *  its own first uploaded photo instead of a customer-authored name. */
  const onSubmit = async () => {
    if (!canSubmit || busy) return;
    setBusy(true);

    try {
      const pairs = await Promise.all(
        items.map(async (it) => ({
          photoPaths: await Promise.all(it.files.map((f) => f.uploadPromise)),
          videoPaths: [] as string[],
          description: it.description.trim() || null,
        })),
      );

      const insertRow: Record<string, unknown> = {
        pairs,
        // Fixed 2026-09-02: this used to be "submitted", a status value
        // nothing downstream ever queried for, so every guest assessment
        // was invisible in the staff queue. "pending" matches what
        // Admin.tsx and the ops_assessments backend actually filter on.
        status: "pending",
        guest_email: email.trim(),
        guest_zip: zip.trim(),
        requested_conditions: requestedConditions,
      };
      if (user) insertRow.user_id = user.id;

      const { data, error } = await supabase
        .from("assessments")
        .insert(insertRow as never)
        .select("id")
        .single();
      if (error) throw error;

      navigate(`/start-repair/assessment/confirmation?id=${data.id}`, { replace: true });
    } catch (e: any) {
      console.error("submit assessment failed", e);
      toast({ title: "Could not submit", description: e?.message || "Please try again.", variant: "destructive" });
      setBusy(false);
    }
  };

  // Restyled 2026-08-26 (Danielle's call) — cream page bg + amber page
  // heading, same page-shell-only scoping as StartRepair.tsx (the upload
  // dropzone/file previews/form below keep their existing functional
  // styling).
  return (
    <main className="min-h-screen flex flex-col bg-white">
      <Header />

      <section className="flex-1 py-12 md:py-16">
        <div className="container max-w-2xl">
          <h1
            className="text-3xl md:text-4xl uppercase"
            style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, color: "#fdb600" }}
          >
            Start a repair
          </h1>
          <p className="mt-2" style={{ color: "#fdb600", fontFamily: "'Instrument Sans', sans-serif", opacity: 0.85 }}>
            We'll review this information and recommend the right repairs.
          </p>

          {/* Turned into an actual section heading (2026-09-24, Danielle's
              call) — sized to match the other field labels on this page
              (Label component's text-sm font-medium), not a big display
              heading. Explicit Instrument Sans font-family added — without
              it this <h2> inherits a serif font from the page's base
              heading styles, rendering visibly different from the
              sans-serif Label text it's supposed to match. */}
          <h2
            className="mt-8 text-sm font-medium leading-none"
            style={{ color: "#3d1700", fontFamily: "'Instrument Sans', sans-serif" }}
          >
            Upload photos of your bag(s) from all sides. Make sure to capture any areas of damage or wear.
          </h2>

          {items.map((item, i) => (
            <ItemUploadCard
              key={item.key}
              item={item}
              index={i}
              total={items.length}
              onFilesChange={(files) => updateItemFiles(item.key, files)}
              onDescriptionChange={(description) => updateItemDescription(item.key, description)}
              onRemove={() => removeItem(item.key)}
              startUpload={startUpload}
            />
          ))}

          {items.length < MAX_ITEMS && (
            <button
              type="button"
              onClick={addItem}
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium underline underline-offset-4"
              style={{ color: "#fdb600" }}
            >
              <Plus size={15} /> Add another item
            </button>
          )}

          {/* Carries over what the customer already checked on the Start a
              Repair checklist (2026-09-02, Danielle's ask) — confirms to
              them that we didn't lose that context when they jumped here,
              and gives staff the same list (see requested_conditions on the
              assessments row, surfaced in Admin.tsx). */}
          {requestedConditions.length > 0 && (
            <div className="mt-6 rounded-lg p-4" style={{ backgroundColor: "#fff5cc" }}>
              <p className="text-sm font-medium" style={{ color: "#3d1700" }}>
                We'll pass along what you'd already flagged:
              </p>
              <p className="mt-1 text-sm" style={{ color: "#3d1700" }}>
                {requestedConditions.join(", ")}
              </p>
            </div>
          )}

          <div className="mt-8 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="assessment-zip">
                Zip code <span className="text-destructive">*</span>
              </Label>
              <Input
                id="assessment-zip"
                inputMode="numeric"
                maxLength={5}
                value={zip}
                onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
                aria-invalid={zipInvalid}
              />
              {zipInvalid && (
                <p className="text-xs text-destructive">
                  We don't currently deliver to {zip}.{" "}
                  <Link to="/faqs" className="underline">See our service areas and request a new service area</Link>.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="proposal-email">
                Where should we send your proposal? <span className="text-destructive">*</span>
              </Label>
              <Input
                id="proposal-email"
                type="email"
                placeholder="you@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-10">
            <Button
              type="button"
              size="lg"
              onClick={onSubmit}
              disabled={!canSubmit}
              className={!canSubmit ? "opacity-50 cursor-not-allowed" : ""}
            >
              {busy ? "Submitting…" : "Submit for review"}
            </Button>
            {!itemsValid && items.some((it) => it.files.length === 0) && (
              <p className="mt-2 text-xs text-destructive">
                {items.length > 1
                  ? "Upload at least one photo of each bag to submit or remove any bags you don't want to include."
                  : "Add at least one photo before submitting."}
              </p>
            )}
            {/* Notice-only, unchecked, at submission time (2026-09-24,
                Danielle's call) — this is the one guest-accessible flow that
                collects personal data (email, description, photos) without
                requiring sign-in first, so both policies should be
                referenced here for coverage. Customers still have to
                actively check the T&Cs box later at guest checkout
                (Checkout.tsx) — this is just a heads-up, not a gate. */}
            <p className="mt-3 text-[13px] text-muted-foreground">
              By submitting, you agree to our{" "}
              <Link to="/privacy-policy" className="underline">
                Privacy Policy
              </Link>{" "}
              and{" "}
              <Link to="/terms-conditions" className="underline">
                Terms &amp; Conditions
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
};

export default AssessmentUpload;
