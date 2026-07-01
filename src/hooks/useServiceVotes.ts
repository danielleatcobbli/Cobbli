import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

type VoteRow = { service_id: string; user_id: string };

export const useServiceVotes = () => {
  const { user } = useAuth();
  const qc = useQueryClient();

  const counts = useQuery({
    queryKey: ["service-vote-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_votes")
        .select("service_id");
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const r of (data ?? []) as { service_id: string }[]) {
        map[r.service_id] = (map[r.service_id] ?? 0) + 1;
      }
      return map;
    },
    staleTime: 30_000,
  });

  const mine = useQuery({
    queryKey: ["service-votes-mine", user?.id ?? null],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_votes")
        .select("service_id, user_id")
        .eq("user_id", user!.id);
      if (error) throw error;
      return new Set(((data ?? []) as VoteRow[]).map((r) => r.service_id));
    },
    staleTime: 30_000,
  });

  const toggle = useMutation({
    mutationFn: async (serviceId: string) => {
      if (user) {
        const hasVote = mine.data?.has(serviceId) ?? false;
        if (hasVote) {
          const { error } = await supabase
            .from("service_votes")
            .delete()
            .eq("service_id", serviceId)
            .eq("user_id", user.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("service_votes")
            .insert({ service_id: serviceId, user_id: user.id });
          if (error) throw error;
        }
      } else {
        // Anonymous vote — always insert; no toggle since we can't identify the voter.
        const { error } = await supabase
          .from("service_votes")
          .insert({ service_id: serviceId, user_id: null });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["service-vote-counts"] });
      qc.invalidateQueries({ queryKey: ["service-votes-mine"] });
    },
  });

  return { counts: counts.data ?? {}, mineSet: mine.data ?? new Set<string>(), toggle, isSignedIn: !!user };
};
