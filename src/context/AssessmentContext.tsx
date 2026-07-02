import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ShoeType } from "@/types/service";
import { canonicalBrand } from "@/components/cobbli/BrandCombobox";

export type AssessmentAiPrefill = {
  shoeType: ShoeType | null;
  colors: string[];
  brand: string | null;
};

export type AssessmentDraftPair = {
  photoPaths: string[];
  videoPaths: string[];
  aiPrefill: AssessmentAiPrefill | null;
  shoeType: ShoeType | null;
  colors: string[];
  brand: string;
};

type State = {
  draft: AssessmentDraftPair;
  aiLoading: boolean;
  setAiLoading: (v: boolean) => void;
  setUploads: (photoPaths: string[], videoPaths: string[]) => void;
  setAiPrefill: (p: AssessmentAiPrefill) => void;
  setDetails: (d: Pick<AssessmentDraftPair, "shoeType" | "colors" | "brand">) => void;
  reset: () => void;
};

const empty: AssessmentDraftPair = {
  photoPaths: [],
  videoPaths: [],
  aiPrefill: null,
  shoeType: null,
  colors: [],
  brand: "",
};

const STORAGE_KEY = "cobbli.assessmentDraft.v1";
const Ctx = createContext<State | undefined>(undefined);

const read = (): AssessmentDraftPair => {
  if (typeof window === "undefined") return empty;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (raw) return { ...empty, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return empty;
};

export const AssessmentProvider = ({ children }: { children: ReactNode }) => {
  const [draft, setDraft] = useState<AssessmentDraftPair>(() => read());
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {
      /* ignore */
    }
  }, [draft]);

  const setUploads = useCallback(
    (photoPaths: string[], videoPaths: string[]) =>
      setDraft((d) => ({ ...d, photoPaths, videoPaths })),
    [],
  );
  const setAiPrefill = useCallback(
    (p: AssessmentAiPrefill) => {
      const normalizedBrand = p.brand ? (canonicalBrand(p.brand) ?? p.brand) : null;
      const normalized = { ...p, brand: normalizedBrand };
      setDraft((d) => ({
        ...d,
        aiPrefill: normalized,
        shoeType: d.shoeType ?? p.shoeType,
        colors: d.colors.length ? d.colors : p.colors,
        brand: d.brand || (normalizedBrand ?? ""),
      }));
    },
    [],
  );
  const setDetails = useCallback(
    (d: Pick<AssessmentDraftPair, "shoeType" | "colors" | "brand">) =>
      setDraft((prev) => ({ ...prev, ...d })),
    [],
  );
  const reset = useCallback(() => {
    setDraft(empty);
    setAiLoading(false);
  }, []);

  const value = useMemo(
    () => ({ draft, aiLoading, setAiLoading, setUploads, setAiPrefill, setDetails, reset }),
    [draft, aiLoading, setUploads, setAiPrefill, setDetails, reset],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useAssessment = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAssessment must be used within AssessmentProvider");
  return ctx;
};
