import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  label?: string;
  size?: "sm" | "md" | "lg";
};

const sizeMap = { sm: "h-5 w-5 border-2", md: "h-8 w-8 border-[3px]", lg: "h-12 w-12 border-4" } as const;

const BrandSpinner = ({ className, label = "Loading", size = "md" }: Props) => (
  <div role="status" aria-live="polite" className={cn("flex items-center justify-center", className)}>
    <span
      aria-hidden="true"
      className={cn(
        "inline-block rounded-full animate-spin border-current/20 border-t-current",
        sizeMap[size],
      )}
      style={{ color: "#3d1700" }}
    />
    <span className="sr-only">{label}…</span>
  </div>
);

export default BrandSpinner;
