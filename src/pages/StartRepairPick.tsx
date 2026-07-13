import { useMemo, useState, useEffect, useRef } from "react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useNavigate, useSearchParams } from "react-router-dom";
import Header from "@/components/cobbli/Header";
import Footer from "@/components/cobbli/Footer";
import StepIndicator from "@/components/cobbli/StepIndicator";
import ConsultationBanner from "@/components/cobbli/ConsultationBanner";
import BrandCombobox, { BRANDS, BRAND_UNKNOWN, canonicalBrand, type BrandMode } from "@/components/cobbli/BrandCombobox";
import { Button } from "@/components/ui/button";
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
import { Plus, X, Loader2, Pencil, Trash2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { apiFetchJson } from "@/integrations/api/client";
import { toast } from "@/hooks/use-toast";
import { SHOE_TYPES, type ShoeType, priceForShoeType, PREMIUM_BRANDS } from "@/types/service";
import { formatPairLabel, usePairs, type SavedPair } from "@/context/PairsContext";
import { createPreviewUrl } from "@/lib/heicPreview";
import { useRepairFlow } from "@/context/RepairFlowContext";
import { useBag, type BagService } from "@/context/BagContext";
import { useAuth } from "@/context/AuthContext";
import SignInCallout from "@/components/cobbli/SignInCallout";
import PaintConsentDialog, { PAINT_CONSENT_SLUGS } from "@/components/cobbli/PaintConsentDialog";
import { useServices } from "@/hooks/useServices";
import { trackEvent } from "@/lib/analytics";

const COLORS = [
"Black", "Blue", "Brown", "Cream", "Denim", "Gold", "Green", "Grey",
"Multi", "Navy", "Orange", "Pattern", "Pink", "Purple", "Red", "Silver",
"Tan", "White", "Yellow",
];

const AddPairModal = ({
  open,
  onOpenChange,
  onSaved,
  isGuest,
  editingPair,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: (id: string) => void;
  isGuest: boolean;
  editingPair?: SavedPair | null;
}) => {
  const { addPair, updatePair } = usePairs();
  const isEditing = !!editingPair;
  const [shoeType, setShoeType] = useState<ShoeType | "">("");
  const [colors, setColors] = useState<string[]>([]);
  const [brandMode, setBrandMode] = useState<BrandMode>("");
  const [brandValue, setBrandValue] = useState("");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [uploadedPaths, setUploadedPaths] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [userEdited, setUserEdited] = useState({ shoeType: false, colors: false, brand: false });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (open) {
      if (editingPair) {
        setShoeType(editingPair.shoeType);
        setColors(editingPair.colors ?? []);
        const b = editingPair.brand;
        if (!b) {
          setBrandMode("");
          setBrandValue("");
        } else if (b === BRAND_UNKNOWN) {
          setBrandMode("unknown");
          setBrandValue("");
        } else if (BRANDS.includes(b)) {
          setBrandMode("list");
          setBrandValue(b);
        } else {
          setBrandMode("custom");
          setBrandValue(b);
        }
        setDescription(editingPair.description ?? "");
        setPhotos([]);
        setPhotoPreviews([]);
        setUploadedPaths(editingPair.photoUrls ?? []);
        setUserEdited({ shoeType: true, colors: true, brand: true });
      } else {
        setShoeType("");
        setColors([]);
        setBrandMode("");
        setBrandValue("");
        setDescription("");
        setPhotos([]);
        setPhotoPreviews([]);
        setUploadedPaths([]);
        setUserEdited({ shoeType: false, colors: false, brand: false });
      }
      setAnalyzing(false);
    }
  }, [open, editingPair]);

  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    (async () => {
      const resolved = await Promise.all(photos.map((f) => createPreviewUrl(f)));
      if (cancelled) {
        resolved.forEach((u) => URL.revokeObjectURL(u));
        return;
      }
      urls.push(...resolved);
      setPhotoPreviews(resolved);
    })();
    return () => {
      cancelled = true;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [photos]);

  const MAX_PHOTOS = 3;
  const MAX_SIZE = 10 * 1024 * 1024;
  const ACCEPTED = ["image/jpeg", "image/jpg", "image/png", "image/heic", "image/heif"];

  const analyzePhotos = async (paths: string[], bucket: string = "pair-photos") => {
    if (paths.length === 0) return;
    setAnalyzing(true);
    try {
      const result = await apiFetchJson<{ shoeType: string | null; colors: string[]; brand: string | null }>(
        "/analyze-shoe-photos/",
        { method: "POST", body: JSON.stringify({ photoPaths: paths, bucket: "pair-photos" }) },
      );
      setShoeType((prev) => {
        if (userEdited.shoeType || prev) return prev;
        return result?.shoeType && SHOE_TYPES.includes(result.shoeType as ShoeType)
          ? (result.shoeType as ShoeType)
          : prev;
      });
      setColors((prev) => {
        if (userEdited.colors || prev.length > 0) return prev;
        const valid = (result?.colors || []).filter((c) => COLORS.includes(c));
        return valid.length > 0 ? valid : prev;
      });
      if (!userEdited.brand && !brandMode && result?.brand) {
        const detected = result.brand.trim();
        const matched = canonicalBrand(detected);
        if (matched) {
          setBrandMode("list");
          setBrandValue(matched);
        } else if (detected) {
          setBrandMode("custom");
          setBrandValue(detected);
        }
      }
    } catch (e) {
      console.error("analyze failed", e);
      toast({
        title: "Couldn't auto-fill",
        description: "We couldn't analyze your photos. Please fill in the details manually.",
        variant: "destructive",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleFiles = async (files: FileList | null) => {
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
    const remaining = MAX_PHOTOS - photos.length;
    if (accepted.length > remaining) {
      toast({ title: "Photo limit", description: `You can upload up to ${MAX_PHOTOS} photos.`, variant: "destructive" });
    }
    const toAdd = accepted.slice(0, remaining);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (toAdd.length === 0) return;

    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    const bucket = uid ? "pair-photos" : "assessment-uploads";
    const folder = uid ? uid : `guest/${Date.now()}-${Math.random().toString(36).slice(2)}`;

    setPhotos((prev) => [...prev, ...toAdd]);
    setUploading(true);
    const newPaths: string[] = [];
    try {
      for (const file of toAdd) {
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage.from(bucket).upload(path, file, {
          contentType: file.type || undefined,
          upsert: false,
        });
        if (error) throw error;
        newPaths.push(path);
      }
      const allPaths = [...uploadedPaths, ...newPaths];
      setUploadedPaths(allPaths);
      void analyzePhotos(allPaths, bucket);
    } catch (e: any) {
      toast({ title: "Upload failed", description: e?.message || "Could not upload photos.", variant: "destructive" });
      setPhotos((prev) => prev.slice(0, prev.length - toAdd.length));
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (idx: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
    setUploadedPaths((prev) => prev.filter((_, i) => i !== idx));
  };

  const valid = shoeType !== "" && colors.length > 0 && brandMode !== "";

  const toggleColor = (c: string) => {
    setUserEdited((p) => ({ ...p, colors: true }));
    setColors((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  };

  const onSave = async () => {
    if (!valid || uploading) return;
    const payload = {
      shoeType: shoeType as ShoeType,
      colors,
      brand: brandMode === "list" ? brandValue
        : brandMode === "custom" ? brandValue.trim()
        : brandMode === "unknown" ? BRAND_UNKNOWN
        : undefined,
      description: description.trim() || undefined,
      photoUrls: uploadedPaths.length ? uploadedPaths : undefined,
    };
    if (isEditing && editingPair) {
      await updatePair(editingPair.id, payload);
      onSaved(editingPair.id);
    } else {
      const pair = addPair(payload);
      onSaved(pair.id);
    }
    onOpenChange(false);
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{isEditing ? "Edit pair" : "Add a new pair"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {(
            <div className="space-y-2">
              <Label>Photos (optional)</Label>
              <p className="text-[13px] text-muted-foreground -mt-1">
                Upload or drag and drop a photo and we'll fill in the details for you.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/heic,image/heif,.jpg,.jpeg,.png,.heic,.heif"
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
              <div
                onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); if (!uploading && photos.length < MAX_PHOTOS) setDragOver(true); }}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = "copy"; if (!uploading && photos.length < MAX_PHOTOS) setDragOver(true); }}
                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragOver(false);
                  if (uploading || photos.length >= MAX_PHOTOS) return;
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    handleFiles(e.dataTransfer.files);
                  }
                }}
                className={`flex flex-wrap gap-2 rounded-md p-2 -m-2 transition-colors ${
                  dragOver ? "bg-secondary/60 ring-2 ring-primary/60" : ""
                }`}
              >
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
                {photos.length < MAX_PHOTOS && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="h-20 w-20 rounded-md border border-dashed border-border flex flex-col items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/60 transition-colors disabled:opacity-50"
                  >
                    {uploading ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                    <span className="text-[11px] mt-1">{uploading ? "Uploading" : (dragOver ? "Drop" : "Add")}</span>
                  </button>
                )}
              </div>
              <p className="text-[12px] text-muted-foreground">
                Up to {MAX_PHOTOS} photos · JPG, PNG, HEIC · max 10MB each
              </p>
              {analyzing && (
                <p className="text-[12px] text-muted-foreground flex items-center gap-1.5">
                  <Loader2 size={12} className="animate-spin" />
                  Analyzing photos…
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="shoe-type">
              Shoe Type <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Select
                value={shoeType}
                onValueChange={(v) => {
                  setUserEdited((p) => ({ ...p, shoeType: true }));
                  setShoeType(v as ShoeType);
                }}
                disabled={analyzing}
              >
                <SelectTrigger id="shoe-type" className={analyzing ? "opacity-60" : ""}>
                  <SelectValue placeholder={analyzing ? "Analyzing…" : "Select shoe type"} />
                </SelectTrigger>
                <SelectContent>
                  {SHOE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {analyzing && (
                <Loader2 size={14} className="absolute right-9 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground pointer-events-none" />
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>
              Color <span className="text-destructive">*</span>
            </Label>
            <p className="text-[13px] text-muted-foreground -mt-1">
              {analyzing ? "Analyzing…" : "Select all that apply"}
            </p>
            <div className={`flex flex-wrap gap-2 ${analyzing ? "opacity-60 pointer-events-none" : ""}`}>
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
            <Label htmlFor="brand">
              Brand <span className="text-destructive">*</span>
            </Label>
            <BrandCombobox
              id="brand"
              mode={brandMode}
              value={brandValue}
              onChange={(m, v) => {
                setUserEdited((p) => ({ ...p, brand: true }));
                setBrandMode(m);
                setBrandValue(v);
              }}
              disabled={analyzing}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Loose stitching on the left toe"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            onClick={onSave}
            disabled={!valid || uploading}
            className={!valid || uploading ? "opacity-50 cursor-not-allowed" : ""}
          >
            {uploading ? "Saving…" : isEditing ? "Save changes" : "Save pair"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const isPremiumBrand = (brand?: string | null) =>
  !!brand && (PREMIUM_BRANDS as readonly string[]).some((b) => b.toLowerCase() === brand.toLowerCase());

const StartRepair = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedService = searchParams.get("service");
  const preselectedBundle = searchParams.get("bundle");
  const preselectedBundlePrice = searchParams.get("bundlePrice");
  const { pairs, deletePair, getPair } = usePairs();
  const {
    selectedPairId,
    setSelectedPairId,
    setSelectedServiceSlugs,
    paintConsents,
    pendingRecommendedItems,
    setPendingRecommendedItems,
  } = useRepairFlow();
  const { findByPairId, addPair: addPairToBag } = useBag();
  const { data: services } = useServices();
  const { user } = useAuth();
  const isGuest = !user;
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [addedServiceName, setAddedServiceName] = useState("");
  const [editingPair, setEditingPair] = useState<SavedPair | null>(null);
  const [pairToDelete, setPairToDelete] = useState<SavedPair | null>(null);
  const [query, setQuery] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  usePageMeta({
    title: "Start a repair — Cobbli",
    description:
"Start a Cobbli repair: pick the pair of shoes you want fixed, choose your services and book door-to-door pickup and return across NYC.",
  });

  const sortedPairs = useMemo(
    () => [...pairs].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [pairs],
  );

  const visiblePairs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sortedPairs;
    return sortedPairs.filter((p) => formatPairLabel(p).toLowerCase().includes(q));
  }, [sortedPairs, query]);

  // Reset bulk selection when leaving select mode or when underlying pairs change.
  useEffect(() => {
    if (!selectMode) setSelectedIds(new Set());
  }, [selectMode]);
  useEffect(() => {
    setSelectedIds((prev) => {
      const next = new Set<string>();
      pairs.forEach((p) => { if (prev.has(p.id)) next.add(p.id); });
      return next;
    });
  }, [pairs]);

  const allVisibleSelected = visiblePairs.length > 0 && visiblePairs.every((p) => selectedIds.has(p.id));
  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        visiblePairs.forEach((p) => next.delete(p.id));
      } else {
        visiblePairs.forEach((p) => next.add(p.id));
      }
      return next;
    });
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const onConfirmBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    setBulkConfirmOpen(false);
    setBulkError(null);
    setBulkDeleting(true);
    const startedAt = Date.now();
    const settleMinDelay = async () => {
      const elapsed = Date.now() - startedAt;
      if (elapsed < 600) await new Promise((r) => setTimeout(r, 600 - elapsed));
    };
    try {
      if (selectedPairId && ids.includes(selectedPairId)) setSelectedPairId(null);
      for (const id of ids) {
        await deletePair(id);
      }
      await settleMinDelay();
      setBulkDeleting(false);
      setSelectedIds(new Set());
      setSelectMode(false);
    } catch (e) {
      await settleMinDelay();
      setBulkDeleting(false);
      setBulkError("Something went wrong. Your shoes weren't deleted — please try again.");
    }
  };

  const onConfirm = () => {
    if (!selectedPairId) return;
    const pair = getPair(selectedPairId);
    if (!pair) return;

    trackEvent("pair_confirmed", { shoe_type: pair.shoeType });

    // Recommendation-flow path — one or more items (a package, individual
    // services, or both) handed off from the "What's going on with your
    // shoes?" checklist (StartRepair.tsx). Checked first since it can carry
    // multiple line items at once, unlike the single service/bundle query
    // params below.
    if (pendingRecommendedItems && pendingRecommendedItems.length > 0) {
      addPairToBag(pendingRecommendedItems, pair.id, formatPairLabel(pair), pair.shoeType);
      trackEvent("repair_added_to_bag", {
        value: pendingRecommendedItems.reduce((sum, s) => sum + s.price, 0) / 100,
        currency: "USD",
        service_count: pendingRecommendedItems.length,
      });
      setSelectedServiceSlugs(pendingRecommendedItems.map((s) => s.id));
      setAddedServiceName(
        pendingRecommendedItems.length === 1
          ? pendingRecommendedItems[0].name
          : pendingRecommendedItems.map((s) => s.name).join(", "),
      );
      setPendingRecommendedItems(null);
      setConfirmOpen(true);
      return;
    }

    // If a specific service was pre-selected (from "Add to repair" on a card),
    // add it to the bag directly and show the upsell modal.
    if (preselectedService && services) {
      const service = services.find((s) => s.slug === preselectedService);
      if (service) {
        const premium = isPremiumBrand(pair.brand);
        const dollars = priceForShoeType(service, pair.shoeType);
        const bagSvc: BagService = {
          id: service.slug,
          name: service.name,
          price: dollars * 100,
          premium,
          ...(PAINT_CONSENT_SLUGS.has(service.slug) && paintConsents[service.slug]
            ? { paintConsent: paintConsents[service.slug] }
            : {}),
        };
        addPairToBag([bagSvc], pair.id, formatPairLabel(pair), pair.shoeType);
        trackEvent("service_added", { service_slug: service.slug, source: "start_repair_pick" });
        trackEvent("repair_added_to_bag", {
          value: bagSvc.price / 100,
          currency: "USD",
          service_count: 1,
        });
        setSelectedServiceSlugs([preselectedService]);
        setAddedServiceName(service.name);
        setConfirmOpen(true);
        return;
      }
    }

    // Bundle path — add the bundle itself to the bag as a single flat-priced
    // line item and show the same upsell modal as a single service, instead
    // of skipping straight to service selection. Bundles aren't backed by
    // real catalog services yet, so this uses the price shown on the bundle
    // card directly (no live-price re-derivation — see BagContext/useLivePricedBag,
    // which safely falls back to the stored snapshot for an unrecognized id).
    if (preselectedBundle && preselectedBundlePrice) {
      const bundleSlug = `bundle-${preselectedBundle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;
      const bagSvc: BagService = {
        id: bundleSlug,
        name: preselectedBundle,
        price: parseInt(preselectedBundlePrice, 10),
      };
      addPairToBag([bagSvc], pair.id, formatPairLabel(pair), pair.shoeType);
      trackEvent("repair_added_to_bag", {
        value: bagSvc.price / 100,
        currency: "USD",
        bundle: preselectedBundle,
      });
      setSelectedServiceSlugs([]);
      setAddedServiceName(preselectedBundle);
      setConfirmOpen(true);
      return;
    }

    // No preselected service or bundle — navigate to service selection.
    const existing = findByPairId(selectedPairId);
    const existingSlugs = existing ? existing.services.map((s) => s.id) : [];
    const merged = preselectedService && !existingSlugs.includes(preselectedService)
      ? [...existingSlugs, preselectedService]
      : existingSlugs;
    setSelectedServiceSlugs(merged);
    navigate("/start-repair/services");
  };

  const canConfirm = !!selectedPairId && pairs.some((p) => p.id === selectedPairId);

  return (
    <main className="min-h-screen bg-white flex flex-col">
      <Header />
      <StepIndicator current="pick" />

      <section className="flex-1 py-12 md:py-16">
        <div className="container max-w-2xl">
          {isGuest && (
            <div className="mb-6">
              <SignInCallout />
            </div>
          )}
          <h1 className="font-display text-3xl md:text-4xl text-primary mb-6">
            Which pair of shoes are you repairing?
          </h1>

          {pairs.length > 0 && (
            <div className="relative mb-4">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by brand, color, or style"
                className="pl-9"
                aria-label="Search saved pairs"
              />
            </div>
          )}

          {pairs.length > 0 && !bulkDeleting && (
            <div className="flex items-center justify-between mb-3 min-h-[36px]">
              {selectMode ? (
                <>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm text-primary cursor-pointer">
                      <Checkbox
                        checked={allVisibleSelected}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all"
                      />
                      Select all
                    </label>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={selectedIds.size === 0}
                      onClick={() => setBulkConfirmOpen(true)}
                      className={selectedIds.size === 0 ? "opacity-50 cursor-not-allowed" : ""}
                    >
                      Delete selected{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
                    </Button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectMode(false)}
                    className="text-sm text-muted-foreground hover:text-primary"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <span />
                  <button
                    type="button"
                    onClick={() => setSelectMode(true)}
                    className="text-sm text-primary hover:underline"
                  >
                    Select
                  </button>
                </>
              )}
            </div>
          )}

          {bulkError && !bulkDeleting && (
            <div
              role="alert"
              className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              Something went wrong. Your shoes weren't deleted — please try again.
            </div>
          )}

          {bulkDeleting ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#3d1700" }} aria-hidden="true" />
              <p className="mt-3 text-sm" style={{ color: "#3d1700" }}>Deleting your shoes…</p>
            </div>
          ) : (
          <div className="space-y-3">
            {visiblePairs.length > 0 ? (
              <ul className="space-y-2">
                {visiblePairs.map((p) => {
                  const id = `pair-${p.id}`;
                  const checked = selectedPairId === p.id;
                  const inBag = !!findByPairId(p.id);
                  const isBulkChecked = selectedIds.has(p.id);
                  return (
                    <li key={p.id}>
                      <div
                        className={`flex items-center gap-3 rounded-lg border p-4 transition-colors ${
                          (!selectMode && checked) || (selectMode && isBulkChecked)
                            ? "border-primary bg-secondary"
                            : "border-border hover:border-primary/40"
                        }`}
                      >
                        {selectMode ? (
                          <label htmlFor={id} className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
                            <Checkbox
                              id={id}
                              checked={isBulkChecked}
                              onCheckedChange={() => toggleOne(p.id)}
                              aria-label={`Select ${formatPairLabel(p)}`}
                            />
                            <span className="text-primary font-medium truncate">{formatPairLabel(p)}</span>
                            {inBag && (
                              <span
                                className="ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium shrink-0"
                                style={{ backgroundColor: "#fdb600", color: "#3d1700" }}
                              >
                                In bag
                              </span>
                            )}
                          </label>
                        ) : (
                          <>
                            <label htmlFor={id} className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
                              <input
                                id={id}
                                type="radio"
                                name="pair"
                                checked={checked}
                                onChange={() => setSelectedPairId(p.id)}
                                className="h-4 w-4 accent-[hsl(var(--primary))]"
                              />
                              <span className="text-primary font-medium truncate">{formatPairLabel(p)}</span>
                              {inBag && (
                                <span
                                  className="ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium shrink-0"
                                  style={{ backgroundColor: "#fdb600", color: "#3d1700" }}
                                >
                                  In bag
                                </span>
                              )}
                            </label>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => { setEditingPair(p); setModalOpen(true); }}
                                aria-label={`Edit ${formatPairLabel(p)}`}
                                className="p-2 rounded-md text-muted-foreground hover:text-primary hover:bg-secondary/60 transition-colors"
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setPairToDelete(p)}
                                aria-label={`Remove ${formatPairLabel(p)}`}
                                className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : pairs.length > 0 && query.trim() ? (
              <p className="text-sm text-muted-foreground py-4">No shoes match your search</p>
            ) : null}

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
            {pairs.length === 0 && (
              <p className="text-sm text-muted-foreground">No shoes saved yet. Add a pair to get started.</p>
            )}
            {isGuest && (
              <p className="text-[13px] text-muted-foreground">
                Your pair will be saved to your account when you check out.
              </p>
            )}
          </div>
          )}

          <div className="mt-8">
            <Button
              type="button"
              size="lg"
              disabled={!canConfirm || selectMode}
              onClick={onConfirm}
              className={!canConfirm || selectMode ? "opacity-50 cursor-not-allowed" : ""}
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
        onOpenChange={(v) => { setModalOpen(v); if (!v) setEditingPair(null); }}
        onSaved={(id) => setSelectedPairId(id)}
        isGuest={isGuest}
        editingPair={editingPair}
      />

      <AlertDialog open={!!pairToDelete} onOpenChange={(v) => { if (!v) setPairToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this pair?</AlertDialogTitle>
            <AlertDialogDescription>
              {pairToDelete ? formatPairLabel(pairToDelete) : ""}
              <br />
              This action can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!pairToDelete) return;
                const id = pairToDelete.id;
                setPairToDelete(null);
                if (selectedPairId === id) setSelectedPairId(null);
                await deletePair(id);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkConfirmOpen} onOpenChange={setBulkConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selectedIds.size} {selectedIds.size === 1 ? "pair" : "pairs"}?
            </AlertDialogTitle>
            <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirmBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl">Added to your bag</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {addedServiceName} added to your bag for this pair.
          </p>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => { setConfirmOpen(false); navigate("/start-repair/services"); }}
            >
              Add more services to this pair
            </Button>
            <Button onClick={() => { setConfirmOpen(false); navigate("/bag"); }}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>

  );
};

export default StartRepair;
