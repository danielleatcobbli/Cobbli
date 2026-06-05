import { useEffect, useState } from "react";
import Header from "@/components/cobbli/Header";
import Footer from "@/components/cobbli/Footer";
import BrandSpinner from "@/components/cobbli/BrandSpinner";
import { supabase } from "@/integrations/supabase/client";
import { usePageMeta } from "@/hooks/usePageMeta";

type AssessmentRow = {
  id: string;
  user_id: string;
  pairs: Array<{
    shoeType?: string | null;
    colors?: string[];
    brand?: string | null;
    photoPaths?: string[];
    videoPaths?: string[];
  }>;
  status: string;
  created_at: string;
  profile?: { first_name: string | null; last_name: string | null; phone: string | null } | null;
};

const Admin = () => {
  usePageMeta({ title: "Admin — Cobbli", description: "Cobbli internal admin." });
  const [rows, setRows] = useState<AssessmentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: assessments, error: aErr } = await supabase
        .from("assessments")
        .select("id, user_id, pairs, status, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (aErr) {
        setError(aErr.message);
        setRows([]);
        return;
      }
      const ids = Array.from(new Set((assessments ?? []).map((a) => a.user_id)));
      const { data: profiles } = ids.length
        ? await supabase.from("profiles").select("user_id, first_name, last_name, phone").in("user_id", ids)
        : { data: [] as any[] };
      const profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
      setRows(
        (assessments ?? []).map((a: any) => ({
          ...a,
          profile: profileMap.get(a.user_id) ?? null,
        })),
      );
    })();
  }, []);

  return (
    <main className="min-h-screen bg-white flex flex-col">
      <Header />
      <section className="flex-1 py-10">
        <div className="container">
          <h1 className="font-display text-3xl md:text-4xl text-primary mb-2">Admin</h1>
          <p className="text-muted-foreground mb-8">Pending photo assessments</p>

          {rows === null ? (
            <BrandSpinner className="py-16" size="lg" />
          ) : error ? (
            <p className="text-destructive">{error}</p>
          ) : rows.length === 0 ? (
            <div className="rounded-lg border border-border p-10 text-center">
              <p className="font-display text-xl text-primary mb-1">No pending assessments</p>
              <p className="text-muted-foreground">New customer photo submissions will show up here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-secondary/60 text-primary">
                  <tr>
                    <th className="text-left p-3">Customer</th>
                    <th className="text-left p-3">Phone</th>
                    <th className="text-left p-3">Pairs</th>
                    <th className="text-left p-3">Pair identifier</th>
                    <th className="text-left p-3">Submitted</th>
                    <th className="text-left p-3">Review</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const name = [r.profile?.first_name, r.profile?.last_name].filter(Boolean).join(" ") || "—";
                    const first = r.pairs?.[0];
                    const id = [first?.colors?.join(" / "), first?.brand, first?.shoeType].filter(Boolean).join(" · ") || "—";
                    return (
                      <tr key={r.id} className="border-t border-border">
                        <td className="p-3">{name}</td>
                        <td className="p-3">{r.profile?.phone || "—"}</td>
                        <td className="p-3">{r.pairs?.length ?? 0}</td>
                        <td className="p-3">{id}</td>
                        <td className="p-3">{new Date(r.created_at).toLocaleString()}</td>
                        <td className="p-3 text-muted-foreground">Review (coming in Phase 3)</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
      <Footer />
    </main>
  );
};

export default Admin;
