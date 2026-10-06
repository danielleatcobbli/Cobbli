import { useEffect, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { apiFetchJson } from "@/integrations/api/client";
import { RepairDetailsRequest } from "./RepairDetails";
export default function AssessmentProposal() {
  const { id, token } = useParams<{ id?: string; token?: string }>();
  const [resolvedId, setResolvedId] = useState<string | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!token) return;
    let active = true;
    setResolvedId(null);
    setError(false);
    apiFetchJson<{ id: string }>(`/public/proposal/${token}`)
      .then(data => { if (active) setResolvedId(data.id); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [token]);
  if (id) return <Navigate to={`/repair/request/${id}`} replace />;
  if (error) return <p role="alert" className="p-8">We couldn't open this repair link. Please contact Cobbli.</p>;
  if (!resolvedId) return <p className="p-8">Loading your repair…</p>;
  return <RepairDetailsRequest id={resolvedId} token={token} />;
}
