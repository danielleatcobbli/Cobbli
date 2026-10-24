import { Link, useLocation } from "react-router-dom";
import { Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

type Props = {
  items: readonly { to: string; label: string }[];
  onSignOut: () => void;
};

export default function MobileAccountNav({ items, onSignOut }: Props) {
  const { pathname } = useLocation();
  const current = items.find(item => pathname === item.to || pathname.startsWith(`${item.to}/`)) ?? items[0];
  return (
    <nav aria-label="Mobile account navigation" className="md:hidden">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label={`Account section: ${current.label}`}
            className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border border-[#3d1700]/20 bg-[#fff5cc] px-4 py-3 text-left text-base font-semibold text-[#3d1700] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3d1700]">
            {current.label}<ChevronDown className="h-5 w-5 shrink-0" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] max-w-[calc(100vw-2rem)] bg-[#fff5cc] text-[#3d1700]">
          {items.map(item => (
            <DropdownMenuItem key={item.to} asChild className="min-h-12 px-3 text-base focus:bg-[#3d1700]/10 focus:text-[#3d1700]">
              <Link to={item.to} aria-current={current.to === item.to ? "page" : undefined} className="flex items-center justify-between gap-3">
                {item.label}{current.to === item.to && <Check className="h-4 w-4" aria-hidden="true" />}
              </Link>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator className="bg-[#3d1700]/20" />
          <DropdownMenuItem onSelect={onSignOut} className="min-h-12 px-3 text-base focus:bg-[#3d1700]/10 focus:text-[#3d1700]">Sign Out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
}
