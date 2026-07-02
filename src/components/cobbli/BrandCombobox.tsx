import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

export const BRANDS = [
  "Acne Studios","Adidas","Alexander McQueen","Alexander Wang","Allen Edmonds",
  "Aquazzura","Ash","Bally","Banana Republic","Birkenstock","Bottega Veneta",
  "Brooks Brothers","Bruno Magli","Burberry","Calvin Klein","Camper","Chanel",
  "Christian Louboutin","Church's","Clarks","Coach","Cole Haan","Common Projects",
  "Converse","Diane von Furstenberg","Doc Martens","Dolce & Gabbana","Ecco",
  "Ermenegildo Zegna","Ferragamo","Frye","Givenchy","Golden Goose","Gucci",
  "Hermès","Hugo Boss","Hunter","J.Crew","Jimmy Choo","Johnston & Murphy",
  "Kate Spade","Kenneth Cole","L.K. Bennett","Lacoste","Loewe","Louis Vuitton",
  "Loro Piana","Manolo Blahnik","Margaux","Massimo Dutti","Miu Miu","Moncler",
  "New Balance","Nike","Off-White","Paul Smith","Prada","Ralph Lauren","Rag & Bone",
  "Rebecca Minkoff","Reebok","Roger Vivier","Russell & Bromley","Saint Laurent",
  "Salvatore Ferragamo","Sam Edelman","Santoni","Sergio Rossi","Steve Madden",
  "Stuart Weitzman","Superga","Talbots","Tods","Tory Burch","UGG","Valentino",
  "Vans","Versace","Vionic","Vince","Want Les Essentiels",
];

export const BRAND_UNKNOWN = "I don't know";
export const BRAND_UNKNOWN_DISPLAY = "Unknown brand";

/** Returns the user-facing brand string, mapping the "I don't know" sentinel to "Unknown brand". */
export const displayBrand = (value?: string | null): string | null => {
  const v = value?.trim();
  if (!v) return null;
  if (v === BRAND_UNKNOWN || v.toLowerCase() === "unknown") return BRAND_UNKNOWN_DISPLAY;
  return v;
};

export type BrandMode = "" | "list" | "custom" | "unknown";

/** Returns the canonical brand from BRANDS if `value` matches case-insensitively, else null. */
export const canonicalBrand = (value: string): string | null => {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  return BRANDS.find((b) => b.toLowerCase() === v) ?? null;
};

export const inferBrandMode = (value: string): BrandMode => {
  if (!value) return "";
  if (value === BRAND_UNKNOWN) return "unknown";
  if (canonicalBrand(value)) return "list";
  return "custom";
};

type Props = {
  id?: string;
  mode: BrandMode;
  value: string;
  onChange: (mode: BrandMode, value: string) => void;
  disabled?: boolean;
};

const BrandCombobox = ({ id, mode, value, onChange, disabled }: Props) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return BRANDS;
    return BRANDS.filter((b) => b.toLowerCase().includes(q));
  }, [query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-brand-idx="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const triggerLabel =
    mode === "list" && value ? value
    : mode === "unknown" ? BRAND_UNKNOWN
    : mode === "custom" ? "My brand isn't listed"
    : "Select brand";

  const selectList = (b: string) => {
    onChange("list", b);
    setOpen(false);
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            disabled={disabled}
            className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className={mode === "" ? "text-muted-foreground" : "text-primary"}>
              {triggerLabel}
            </span>
            <ChevronDown size={16} className="opacity-60" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="p-0 w-[--radix-popover-trigger-width] max-w-none"
          align="start"
        >
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Search size={14} className="opacity-60" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActiveIndex((i) => Math.min(filtered.length - 1, i + 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActiveIndex((i) => Math.max(0, i - 1));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  const choice = filtered[activeIndex];
                  if (choice) selectList(choice);
                }
              }}
              placeholder="Search brands…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          <div
            ref={listRef}
            className="max-h-72 overflow-y-auto py-1 overscroll-contain"
            onWheel={(e) => {
              const el = e.currentTarget;
              const max = el.scrollHeight - el.clientHeight;
              if (max <= 0) return;
              const next = Math.min(max, Math.max(0, el.scrollTop + e.deltaY));
              if (next !== el.scrollTop) {
                el.scrollTop = next;
                e.stopPropagation();
              }
            }}
          >
            <button
              type="button"
              onClick={() => {
                onChange("custom", "");
                setOpen(false);
              }}
              className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-muted text-primary"
            >
              <span>My brand isn't listed</span>
              {mode === "custom" && <Check size={14} />}
            </button>
            <button
              type="button"
              onClick={() => {
                onChange("unknown", BRAND_UNKNOWN);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-muted text-primary"
            >
              <span>I don't know the brand</span>
              {mode === "unknown" && <Check size={14} />}
            </button>
            <div className="my-1 border-t" />
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-sm text-muted-foreground">No brands match "{query}".</p>
            ) : (
              filtered.map((b, i) => {
                const selected = mode === "list" && value === b;
                const active = i === activeIndex;
                return (
                  <button
                    key={b}
                    type="button"
                    data-brand-idx={i}
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => selectList(b)}
                    className={`flex w-full items-center justify-between px-3 py-2 text-sm ${
                      active ? "bg-muted" : ""
                    } ${selected ? "text-primary font-medium" : "text-primary"}`}
                  >
                    <span>{b}</span>
                    {selected && <Check size={14} />}
                  </button>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>

      {mode === "custom" && (
        <Input
          autoFocus
          maxLength={250}
          value={value}
          onChange={(e) => onChange("custom", e.target.value)}
          placeholder="Type the brand name"
        />
      )}
    </div>
  );
};

export default BrandCombobox;
