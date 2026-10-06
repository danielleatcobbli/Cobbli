import { apiFetchJson } from "@/integrations/api/client";

/** Integration contract for Olivier. No fallback writes to customer-editable assessment JSON. */
export type CustomerQuestion = {
  id: string;
  body: string;
  created_at: string;
  pair_id?: string;
  attachments?: { url: string; alt?: string }[];
  response_received?: boolean;
};
export type ResponseReceipt = { response_id: string; saved: true };
export type ResponseTransport = {
  load: () => Promise<CustomerQuestion>;
  send: (questionId: string, text: string, files: File[], submissionId: string) => Promise<ResponseReceipt>;
};
export function repairResponseTransport(id: string, token?: string): ResponseTransport {
  const path = `/customer/requests/${encodeURIComponent(id)}`;
  const headers: Record<string, string> = token ? { "X-Repair-Token": token } : {};
  return {
    load: () => apiFetchJson<CustomerQuestion>(`${path}/question`, { headers }),
    send: (questionId, text, files, submissionId) => {
      const body = new FormData();
      body.set("question_id", questionId);
      body.set("text", text);
      body.set("submission_id", submissionId);
      files.forEach(file => body.append("photos", file));
      return apiFetchJson<ResponseReceipt>(`${path}/responses`, { method: "POST", headers, body });
    },
  };
}
