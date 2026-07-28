import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatCardProps = {
  label: string;
  sublabel?: string;
  value: string;
  sparkline?: number[];
  color?: string;
  allTime?: boolean;
};

/** Small stat tile with an optional trailing sparkline, used across
 * Order Economics, Workshop stats, and the pinned Customer Health row.
 * `allTime` applies the amber "ALL-TIME" treatment agreed on during
 * mockup review, for the four lifetime metrics that never respond to
 * the period filter. */
const StatCard = ({ label, sublabel, value, sparkline, color = "#3d7bfd", allTime }: StatCardProps) => {
  const data = (sparkline ?? []).map((v, i) => ({ i, v }));
  return (
    <div
      className={cn(
        "rounded-lg border p-3.5",
        allTime ? "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900" : "bg-muted/30",
      )}
    >
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground leading-snug min-h-[28px]">
        {label}
        {allTime && (
          <Badge className="ml-1.5 align-middle bg-amber-500 hover:bg-amber-500 text-white text-[9px] px-1.5 py-0">
            ALL-TIME
          </Badge>
        )}
        {sublabel && <div className="font-normal normal-case tracking-normal mt-0.5">{sublabel}</div>}
      </div>
      <div className="text-xl font-bold text-foreground mt-1.5 mb-0.5">{value}</div>
      {data.length > 1 && (
        <div className="h-9 -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 2, right: 2, bottom: 0, left: 2 }}>
              <Area type="monotone" dataKey="v" stroke={color} fill={color} fillOpacity={0.13} strokeWidth={2} dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default StatCard;
