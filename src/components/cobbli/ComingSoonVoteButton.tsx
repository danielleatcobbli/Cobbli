import { useEffect, useState } from "react";
import { ThumbsUp, Check } from "lucide-react";
import { useServiceVotes } from "@/hooks/useServiceVotes";

const ANON_VOTES_KEY = "cobbli.anonServiceVotes";

type Props = {
  serviceId: string | undefined;
  className?: string;
};

/**
 * Shared "Vote for us to add this service" button used on coming-soon
 * service cards and detail pages. Handles anonymous (localStorage) and
 * signed-in voting, plus the voted/unvoted visual state.
 */
const ComingSoonVoteButton = ({ serviceId, className = "" }: Props) => {
  const { mineSet, toggle, isSignedIn } = useServiceVotes();
  const [anonVoted, setAnonVoted] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ANON_VOTES_KEY);
      if (raw) setAnonVoted(new Set(JSON.parse(raw)));
    } catch {
      /* ignore */
    }
  }, []);

  const voted = serviceId
    ? isSignedIn
      ? mineSet.has(serviceId)
      : anonVoted.has(serviceId)
    : false;

  const handleVote = () => {
    if (!serviceId) return;
    if (!isSignedIn && anonVoted.has(serviceId)) return;
    toggle.mutate(serviceId, {
      onSuccess: () => {
        if (!isSignedIn) {
          setAnonVoted((prev) => {
            const next = new Set(prev);
            next.add(serviceId);
            try {
              localStorage.setItem(ANON_VOTES_KEY, JSON.stringify([...next]));
            } catch {
              /* ignore */
            }
            return next;
          });
        }
      },
    });
  };

  return (
    <button
      type="button"
      onClick={handleVote}
      disabled={toggle.isPending || !serviceId}
      aria-pressed={voted}
      className={`w-full inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
        voted
          ? "border-transparent text-white"
          : "border-border text-primary hover:border-primary/60"
      } ${toggle.isPending ? "opacity-60 cursor-not-allowed" : ""} ${className}`}
      style={voted ? { backgroundColor: "#3d1700" } : undefined}
    >
      {voted ? <Check size={14} /> : <ThumbsUp size={14} />}
      <span>{voted ? "Voted — thank you" : "Vote for us to add this service"}</span>
    </button>
  );
};

export default ComingSoonVoteButton;
