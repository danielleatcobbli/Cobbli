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

const MAX_FILES = 10;
const MAX_SIZE = 50 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/heic", "image/heif"];
const VIDEO_TYPES = ["video/mp4", "video/quicktime"];
const ACCEPT = "image/jpeg,image/png,image/heic,image/heif,video/mp4,video/quicktime,.jpg,.jpeg,.png,.heic,.heif,.mp4,.mov";

type Picked = { file: File; preview: string; kind: "image" | "video" };

const isImage = (f: File) => {
  const ext = f.name.toLowerCase().split(".").pop() || "";
  return IMAGE_TYPES.includes(f.type) || ["jpg", "jpeg", "png", "heic", "heif"].includes(ext);
};
const isVideo = (f: File) => {
  const ext = f.name.toLowerCase().split(".").pop() || "";
  return VIDEO_TYPES.includes(f.type) || ["mp4", "mov"].includes(ext);
};

const AssessmentUpload = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { setUploads, setAiPrefill, reset } = useAssessment();
  const [files, setFiles] = useState<Picked[]>([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  usePageMeta({
    title: "Show us your shoes — Cobbli",
    description:
      "Upload photos or a short video of your shoes and Cobbli's cobblers will recommend the right repairs.",
  });

  useEffect(() => {
    if (!loading && !user) {
      navigate("/signin", { state: { from: "/start-repair/assessment" } });
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    return () => files.forEach((f) => URL.revokeObjectURL(f.preview));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      accepted.push({ file: f, preview: URL.createObjectURL(f), kind: image ? "image" : "video" });
    }
    setFiles((prev) => {
      const remaining = MAX_FILES - prev.length;
      if (accepted.length > remaining) {
        toast({ title: "File limit", description: `You can upload up to ${MAX_FILES} files.`, variant: "destructive" });
      }
      return [...prev, ...accepted.slice(0, remaining)];
    });
    if (inputRef.current) inputRef.current.value = "";
  };

  const remove = (idx: number) =>
    setFiles((prev) => {
      const next = [...prev];
      const [gone] = next.splice(idx, 1);
      if (gone) URL.revokeObjectURL(gone.preview);
      return next;
    });

  const onNext = async () => {
    if (!user || files.length === 0 || busy) return;
    setBusy(true);
    reset();
    const ts = Date.now().toString();
    const photoPaths: string[] = [];
    const videoPaths: string[] = [];
    try {
      for (const picked of files) {
        const ext = (picked.file.name.split(".").pop() || (picked.kind === "image" ? "jpg" : "mp4")).toLowerCase();
        const path = `${user.id}/${ts}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage
          .from("assessment-uploads")
          .upload(path, picked.file, { contentType: picked.file.type || undefined, upsert: false });
        if (error) throw error;
        if (picked.kind === "image") photoPaths.push(path);
        else videoPaths.push(path);
      }
      setUploads(photoPaths, videoPaths);

      // Best-effort AI prefill (don't block navigation if it fails)
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

      navigate("/start-repair/assessment/details");
    } catch (e: any) {
      toast({ title: "Upload failed", description: e?.message || "Could not upload your files.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
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
            className="mt-8 w-full rounded-xl border-2 border-dashed border-border p-8 text-center hover:border-primary/60 hover:bg-secondary/40 transition-colors"
          >
            <Plus className="mx-auto mb-2" />
            <p className="font-medium text-primary">Upload photos or a video</p>
            <p className="text-xs text-muted-foreground mt-1">
              JPG, PNG, HEIC, MP4, MOV · up to {MAX_FILES} files · 50MB max each
            </p>
          </button>

          {files.length > 0 && (
            <div className="mt-5 grid grid-cols-3 sm:grid-cols-4 gap-3">
              {files.map((f, idx) => (
                <div key={idx} className="relative aspect-square rounded-md overflow-hidden border border-border bg-secondary/40">
                  {f.kind === "image" ? (
                    <img src={f.preview} alt={`Upload ${idx + 1}`} className="h-full w-full object-cover" />
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
