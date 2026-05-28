import { useMemo, useState, useEffect, useRef } from "react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useNavigate } from "react-router-dom";
import Header from "@/components/cobbli/Header";
import Footer from "@/components/cobbli/Footer";
import StepIndicator from "@/components/cobbli/StepIndicator";
import ConsultationBanner from "@/components/cobbli/ConsultationBanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { SHOE_TYPES, type ShoeType } from "@/data/services";
import { formatPairLabel, usePairs } from "@/context/PairsContext";
import { useRepairFlow } from "@/context/RepairFlowContext";
import { useBag } from "@/context/BagContext";

const COLORS = [
  "Black", "Blue", "Brown", "Cream", "Denim", "Gold", "Green", "Grey",
  "Multi", "Navy", "Orange", "Pattern", "Pink", "Purple", "Red", "Silver",
  "Tan", "White", "Yellow",
];

const AddPairModal = ({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: (id: string) => void;
}) => {
  const { addPair } = usePairs();
  const [shoeType, setShoeType] = useState<ShoeType | "">("");
  const [colors, setColors] = useState<string[]>([]);
  const [brand, setBrand] = useState("");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setShoeType("");
      setColors([]);
      setBrand("");
      setDescription("");
      setPhotos([]);
      setPhotoPreviews([]);
    }
  }, [open]);

  useEffect(() => {
    const urls = photos.map((f) => URL.createObjectURL(f));
    setPhotoPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [photos]);

  const MAX_PHOTOS = 5;
  const MAX_SIZE = 10 * 1024 * 1024;
  const ACCEPTED = ["image/jpeg", "image/jpg", "image/png", "image/heic", "image/heif"];

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const incoming = Array.from(files);
    const accepted: File[] = [];
    for (const f of incoming) {
      const ext = f.name.toLowerCase().split(".").pop() || "";
      const okType = ACCEPTED.includes(f.type) || ["jpg", "jpeg", "png", "heic", "heif"].includes(ext);
      if (!okType) {
        toast({ title: "Unsupported file", description: `${f.name} must be JPG, PNG, or HEIC.`, variant: "destructive" });
        continue;
      }
      if (f.size > MAX_SIZE) {
        toast({ title: "File too large", description: `${f.name} exceeds 10MB.`, variant: "destructive" });
        continue;
      }
      accepted.push(f);
    }
    setPhotos((prev) => {
      const remaining = MAX_PHOTOS - prev.length;
      if (accepted.length > remaining) {
        toast({ title: "Photo limit", description: `You can upload up to ${MAX_PHOTOS} photos.`, variant: "destructive" });
      }
      return [...prev, ...accepted.slice(0, remaining)];
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePhoto = (idx: number) => setPhotos((prev) => prev.filter((_, i) => i !== idx));

  const valid = shoeType !== "" && colors.length > 0;

  const toggleColor = (c: string) =>
    setColors((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const onSave = async () => {
    if (!valid || uploading) return;
    setUploading(true);
    let photoUrls: string[] = [];
    try {
      if (photos.length > 0) {
        const { data: userData } = await supabase.auth.getUser();
        const uid = userData.user?.id;
        if (!uid) {
          toast({ title: "Sign in required", description: "Please sign in to upload photos.", variant: "destructive" });
          setUploading(false);
          return;
        }
        const pairFolder = (typeof crypto !== "undefined" && "randomUUID" in crypto) ? crypto.randomUUID() : Math.random().toString(36).slice(2);
        for (const file of photos) {
          const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
          const path = `${uid}/${pairFolder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
          const { error } = await supabase.storage.from("pair-photos").upload(path, file, {
            contentType: file.type || undefined,
            upsert: false,
          });
          if (error) throw error;
          photoUrls.push(path);
        }
      }
      const pair = addPair({
        shoeType: shoeType as ShoeType,
        colors,
        brand: brand.trim() || undefined,
        description: description.trim() || undefined,
        photoUrls: photoUrls.length ? photoUrls : undefined,
      });
      onSaved(pair.id);
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Upload failed", description: e?.message || "Could not upload photos.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Add a new pair</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="shoe-type">
              Shoe Type <span className="text-destructive">*</span>
            </Label>
            <Select value={shoeType} onValueChange={(v) => setShoeType(v as ShoeType)}>
              <SelectTrigger id="shoe-type">
                <SelectValue placeholder="Select shoe type" />
              </SelectTrigger>
              <SelectContent>
                {SHOE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>
              Color <span className="text-destructive">*</span>
            </Label>
            <p className="text-[13px] text-muted-foreground -mt-1">
              Select all that apply
            </p>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => {
                const selected = colors.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleColor(c)}
                    aria-pressed={selected}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                      selected
                        ? "bg-secondary text-primary"
                        : "bg-card text-muted-foreground hover:text-primary"
                    }`}
                    style={{
                      borderColor: selected ? "#3d1700" : "hsl(var(--border))",
                      borderWidth: selected ? 2 : 1,
                    }}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="brand">Brand</Label>
            <Input
              id="brand"
              maxLength={250}
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="Optional"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Photos (optional)</Label>
            <p className="text-[13px] text-muted-foreground -mt-1">Add photos of your shoes</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/heic,image/heif,.jpg,.jpeg,.png,.heic,.heif"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <div className="flex flex-wrap gap-2">
              {photoPreviews.map((src, idx) => (
                <div key={idx} className="relative h-20 w-20 rounded-md overflow-hidden border border-border">
                  <img src={src} alt={`Photo ${idx + 1}`} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(idx)}
                    aria-label={`Remove photo ${idx + 1}`}
                    className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              {photos.length < 5 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-20 w-20 rounded-md border border-dashed border-border flex flex-col items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/60 transition-colors"
                >
                  <Plus size={18} />
                  <span className="text-[11px] mt-1">Add</span>
                </button>
              )}
            </div>
            <p className="text-[12px] text-muted-foreground">
              Up to 5 photos · JPG, PNG, HEIC · max 10MB each
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            onClick={onSave}
            disabled={!valid || uploading}
            className={!valid || uploading ? "opacity-50 cursor-not-allowed" : ""}
          >
            {uploading ? "Saving…" : "Save pair"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const StartRepair = () => {
  const navigate = useNavigate();
  const { pairs } = usePairs();
  const { selectedPairId, setSelectedPairId, setSelectedServiceSlugs } = useRepairFlow();
  const { findByPairId } = useBag();
  const [modalOpen, setModalOpen] = useState(false);

  usePageMeta({
    title: "Start a repair — Cobbli",
    description:
      "Start a Cobbli repair: pick the pair of shoes you want fixed, choose your services and book door-to-door pickup and return across NYC.",
  });

  const sortedPairs = useMemo(
    () => [...pairs].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [pairs],
  );

  const onConfirm = () => {
    if (!selectedPairId) return;
    const existing = findByPairId(selectedPairId);
    setSelectedServiceSlugs(existing ? existing.services.map((s) => s.id) : []);
    navigate("/start-repair/services");
  };

  const canConfirm = !!selectedPairId && pairs.some((p) => p.id === selectedPairId);

  return (
    <main className="min-h-screen bg-white flex flex-col">
      <Header />
      <StepIndicator current="pick" />

      <section className="flex-1 py-12 md:py-16">
        <div className="container max-w-2xl">
          <h1 className="font-display text-3xl md:text-4xl text-primary mb-8">
            Which pair of shoes are you repairing?
          </h1>

          <div className="space-y-3">
            {sortedPairs.length > 0 && (
              <ul className="space-y-2">
                {sortedPairs.map((p) => {
                  const id = `pair-${p.id}`;
                  const checked = selectedPairId === p.id;
                  const inBag = !!findByPairId(p.id);
                  return (
                    <li key={p.id}>
                      <label
                        htmlFor={id}
                        className={`flex items-center gap-3 rounded-lg border p-4 cursor-pointer transition-colors ${
                          checked ? "border-primary bg-secondary" : "border-border hover:border-primary/40"
                        }`}
                      >
                        <input
                          id={id}
                          type="radio"
                          name="pair"
                          checked={checked}
                          onChange={() => setSelectedPairId(p.id)}
                          className="h-4 w-4 accent-[hsl(var(--primary))]"
                        />
                        <span className="text-primary font-medium">{formatPairLabel(p)}</span>
                        {inBag && (
                          <span
                            className="ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
                            style={{ backgroundColor: "#fdb600", color: "#3d1700" }}
                          >
                            In bag
                          </span>
                        )}
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}

            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="w-full flex items-center gap-3 rounded-lg border border-dashed border-border p-4 text-primary hover:border-primary/60 hover:bg-secondary/40 transition-colors"
            >
              <span className="h-6 w-6 rounded-full bg-secondary flex items-center justify-center">
                <Plus size={16} />
              </span>
              <span className="font-medium">Add a new pair</span>
            </button>
          </div>

          <div className="mt-8">
            <Button
              type="button"
              size="lg"
              disabled={!canConfirm}
              onClick={onConfirm}
              className={!canConfirm ? "opacity-50 cursor-not-allowed" : ""}
            >
              Confirm pair
            </Button>
          </div>

          <div className="mt-10">
            <ConsultationBanner />
          </div>
        </div>
      </section>

      <Footer />

      <AddPairModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSaved={(id) => setSelectedPairId(id)}
      />
    </main>
  );
};

export default StartRepair;
