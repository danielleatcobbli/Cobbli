import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, X, FileVideo, Play } from "lucide-react";
import Header from "@/components/cobbli/Header";
import Footer from "@/components/cobbli/Footer";
import StepIndicator from "@/components/cobbli/StepIndicator";
import { ASSESSMENT_STEPS } from "@/components/cobbli/assessmentSteps";
import { Button } from "@/components/ui/button";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAssessment } from "@/context/AssessmentContext";
import { createPreviewUrl } from "@/lib/heicPreview";

const MAX_FILES = 10;
const MAX_SIZE = 50 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/heic", "image/heif"];
const VIDEO_TYPES = ["video/mp4", "video/quicktime"];
const ACCEPT = "image/jpeg,image/png,image/heic,image/heif,video/mp4,video/quicktime,.jpg,.jpeg,.png,.heic,.heif,.mp4,.mov";

type Picked = { file: File; preview: string; kind: "image" | "video"; thumbnail?: string; thumbnailFailed?: boolean };

const generateVideoThumbnail = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    try {
      const url = URL.createObjectURL(file);
      const video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true;
      video.playsInline = true;
      video.crossOrigin = "anonymous";
      video.src = url;

      const cleanup = () => URL.revokeObjectURL(url);

      const onError = () => {
        cleanup();
        reject(new Error("video load error"));
      };

      video.onloadedmetadata = () => {
        try {
          video.currentTime = Math.min(0.1, (video.duration || 1) / 2);
        } catch (e) {
          onError();
        }
      };
      video.onseeked = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth || 320;
          canvas.height = video.videoHeight || 240;
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("no canvas ctx");
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const data = canvas.toDataURL("image/jpeg", 0.7);
          cleanup();
          resolve(data);
        } catch (e) {
          cleanup();
          reject(e);
        }
      };
      video.onerror = onError;
    } catch (e) {
      reject(e);
    }
  });

const isImage = (f: File) => {
  const ext = f.name.toLowerCase().split(".").pop() || "";
  return IMAGE_TYPES.includes(f.type) || ["jpg", "jpeg", "png", "heic", "heif"].includes(ext);
};
const isVideo = (f: File) => {
  const ext = f.name.toLowerCase().split(".").pop() || "";
  return VIDEO_TYPES.includes(f.type) || ["mp4", "mov"].includes(ext);
};

type UploadEntry = { kind: "image" | "video"; promise: Promise<string> };

const AssessmentUpload = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { setUploads, setAiPrefill, reset, setAiLoading } = useAssessment();
  const [files, setFiles] = useState<Picked[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadMapRef = useRef<Map<File, UploadEntry>>(new Map());
  const sessionTsRef = useRef<string>("");

  usePageMeta({
    title: "Show us your shoes — Cobbli",
    description:
"Upload photos or a short video of your shoes and Cobbli's cobblers will recommend the right repairs.",
  });

  useEffect(() => {
    return () => files.forEach((f) => URL.revokeObjectURL(f.preview));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startUpload = (picked: Picked): Promise<string> => {
    if (!sessionTsRef.current) sessionTsRef.current = Date.now().toString();
    const ts = sessionTsRef.current;
    const ext = (picked.file.name.split(".").pop() || (picked.kind === "image" ? "jpg" : "mp4")).toLowerCase();
    const folder = user ? user.id : `guest/${ts}`;
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    return supabase.storage
      .from("assessment-uploads")
      .upload(path, picked.file, { contentType: picked.file.type || undefined, upsert: false })
      .then(({ error }) => {
        if (error) throw error;
        return path;
      });
  };

  const onPick = (list: FileList | null) => {
    if (!list) return;
    const incoming = Array.from(list);
    const accepted: Picked[] = [];
    for (const f of incoming) {
      const image = isImage(f);
      const video = isVideo(f);
      if (!image && !video) {
        toast({ title: "Unsupported file", description: `${f.name} must be JPG, PNG, HEIC, MP4 or MOV.`, variant: "destructive" });
        continue;
      }
      if (f.size > MAX_SIZE) {
        toast({ title: "File too large", description: `${f.name} exceeds 50MB.`, variant: "destructive" });
        continue;
      }
      const picked: Picked = { file: f, preview: URL.createObjectURL(f), kind: image ? "image" : "video" };
      accepted.push(picked);
      const name = f.name.toLowerCase();
      const isHeic =
        f.type === "image/heic" ||
        f.type === "image/heif" ||
        name.endsWith(".heic") ||
        name.endsWith(".heif");
      if (image && isHeic) {
        createPreviewUrl(f).then((url) => {
          setFiles((curr) =>
            curr.map((p) => {
              if (p.file !== f) return p;
              URL.revokeObjectURL(p.preview);
              return { ...p, preview: url };
            }),
          );
        });
      }
    }
    setFiles((prev) => {
      const remaining = MAX_FILES - prev.length;
      if (accepted.length > remaining) {
        toast({ title: "File limit", description: `You can upload up to ${MAX_FILES} files.`, variant: "destructive" });
      }
      const added = accepted.slice(0, remaining);
      added.forEach((picked) => {
        // kick upload immediately in parallel
        const promise = startUpload(picked).catch((e) => {
          console.warn("upload failed", e);
          throw e;
        });
        uploadMapRef.current.set(picked.file, { kind: picked.kind, promise });

        if (picked.kind !== "video") return;
        generateVideoThumbnail(picked.file)
          .then((thumb) => {
            setFiles((curr) =>
              curr.map((p) => (p.file === picked.file ? { ...p, thumbnail: thumb } : p)),
            );
          })
          .catch(() => {
            setFiles((curr) =>
              curr.map((p) => (p.file === picked.file ? { ...p, thumbnailFailed: true } : p)),
            );
          });
      });
      return [...prev, ...added];
    });
    if (inputRef.current) inputRef.current.value = "";
  };

  const remove = (idx: number) =>
    setFiles((prev) => {
      const next = [...prev];
      const [gone] = next.splice(idx, 1);
      if (gone) {
        URL.revokeObjectURL(gone.preview);
        uploadMapRef.current.delete(gone.file);
      }
      return next;
    });

  const onNext = () => {
    if (files.length === 0 || busy) return;
    setBusy(true);
    reset();
    setAiLoading(true);

    const currentFiles = [...files];
    const entries = currentFiles
      .map((p) => ({ picked: p, entry: uploadMapRef.current.get(p.file) }))
      .filter((x): x is { picked: Picked; entry: UploadEntry } => !!x.entry);

    // Fire-and-forget: complete uploads + AI in background. Navigation is immediate.
    (async () => {
      try {
        const results = await Promise.all(
          entries.map((x) => x.entry.promise.then((path) => ({ kind: x.picked.kind, path }))),
        );
        const photoPaths = results.filter((r) => r.kind === "image").map((r) => r.path);
        const videoPaths = results.filter((r) => r.kind === "video").map((r) => r.path);
        setUploads(photoPaths, videoPaths);

        try {
          const { data, error: fnErr } = await supabase.functions.invoke("analyze-shoe-photos", {
            body: { photoPaths },
          });
          if (fnErr) throw fnErr;
          setAiPrefill({
            shoeType: data?.shoeType ?? null,
            colors: Array.isArray(data?.colors) ? data.colors : [],
            brand: data?.brand ?? null,
          });
        } catch (e) {
          console.warn("AI prefill failed", e);
          setAiPrefill({ shoeType: null, colors: [], brand: null });
        }
      } catch (e: any) {
        console.warn("Upload failed", e);
        setAiPrefill({ shoeType: null, colors: [], brand: null });
        toast({ title: "Upload failed", description: e?.message || "Could not upload your files.", variant: "destructive" });
      } finally {
        setAiLoading(false);
      }
    })();

    navigate("/start-repair/assessment/details");
    setBusy(false);
  };

  const canNext = files.length > 0 && !busy;

  return (
    <main className="min-h-screen bg-white flex flex-col">
      <Header />
      <StepIndicator steps={ASSESSMENT_STEPS} current="upload" ariaLabel="Assessment progress" />

      <section className="flex-1 py-12 md:py-16">
        <div className="container max-w-2xl">
          <h1 className="font-display text-3xl md:text-4xl text-primary">Show us your shoes</h1>
          <p className="mt-2 text-primary/80">
            Upload photos or a short video and we'll recommend the right repairs.
          </p>

          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            multiple
            className="hidden"
            onChange={(e) => onPick(e.target.files)}
          />

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
            className={`mt-8 w-full rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
              dragOver
                ? "border-primary bg-secondary/60"
                : "border-border hover:border-primary/60 hover:bg-secondary/40"
            }`}
          >
            <Plus className="mx-auto mb-2" />
            <p className="font-medium text-primary">
              {dragOver ? "Drop files to upload" : "Upload photos or a short video of your shoes"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              JPG, PNG, HEIC, MP4, MOV · up to {MAX_FILES} files · 50MB max each
            </p>
          </button>
          <p className="mt-2 text-sm italic text-muted-foreground">
            We'll use your photo or video to fill in as many shoe details as we can
          </p>

          {files.length > 0 && (
            <div className="mt-5 grid grid-cols-3 sm:grid-cols-4 gap-3">
              {files.map((f, idx) => (
                <div key={idx} className="relative aspect-square rounded-md overflow-hidden border border-border bg-secondary/40">
                  {f.kind === "image" ? (
                    <img src={f.preview} alt={`Upload ${idx + 1}`} className="h-full w-full object-cover" />
                  ) : f.thumbnail ? (
                    <>
                      <img src={f.thumbnail} alt={`Video ${idx + 1}`} className="h-full w-full object-cover" />
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div
                          className="h-10 w-10 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
                        >
                          <Play size={18} className="text-white fill-white ml-0.5" />
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="h-full w-full flex flex-col items-center justify-center text-muted-foreground p-2">
                      <FileVideo size={28} />
                      <span className="mt-1 text-[11px] truncate w-full text-center">{f.file.name}</span>
                    </div>
                  )}
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
            </div>
          )}

          <div
            className="mt-6 rounded-lg p-4 text-sm text-primary"
            style={{ backgroundColor: "#fff5cc", border: "1px solid #fdb600" }}
          >
            <strong>Tip:</strong> Upload a short video or photos of the shoe from all sides. Make sure to capture any areas of damage or wear. The more we can see, the better our recommendation.
          </div>

          <div className="mt-8">
            <Button
              type="button"
              size="lg"
              onClick={onNext}
              disabled={!canNext}
              className={!canNext ? "opacity-50 cursor-not-allowed" : ""}
            >
              {busy ? "Uploading…" : "Next"}
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
};

export default AssessmentUpload;
