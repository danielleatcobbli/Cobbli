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

export type BrandMode = "" | "list" | "custom" | "unknown";

export const inferBrandMode = (value: string): BrandMode => {
  if (!value) return "";
  if (value === BRAND_UNKNOWN) return "unknown";
  if (BRANDS.includes(value)) return "list";
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
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return BRANDS;
    return BRANDS.filter((b) => b.toLowerCase().includes(q));
  }, [query]);

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
              placeholder="Search brands…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          <div className="max-h-72 overflow-y-auto py-1">
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
              filtered.map((b) => {
                const selected = mode === "list" && value === b;
                return (
                  <button
                    key={b}
                    type="button"
                    onClick={() => selectList(b)}
                    className={`flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-muted ${
                      selected ? "text-primary font-medium" : "text-primary"
                    }`}
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
