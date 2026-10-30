export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export type PromptSummary = { name: string; versions: number; latest_version: number | null; created_at: string };
export type PromptVersion = {
  id: string; version: number; template: string; model: string; temperature: number;
  max_tokens: number; note: string | null; variables: string[]; created_at: string;
};
export type DatasetSummary = { name: string; versions: number; latest_version: number | null };
export type Case = { id: string; idx: number; variables: Record<string, unknown>; expected: string | null; criteria: string | null };
export type Run = {
  id: string; status: 'queued' | 'running' | 'completed' | 'failed'; scorer: string; total: number; completed: number;
  avg_score: number | null; pass_rate: number | null; avg_latency_ms: number | null;
  input_tokens: number | null; output_tokens: number | null; error: string | null; created_at: string;
  prompt: string; prompt_version: number; model: string; dataset: string; dataset_version: number;
  dataset_version_id: string;
};
export type Result = {
  case_id: string; idx: number; variables: Record<string, unknown>; expected: string | null;
  output: string | null; score: number; passed: boolean; reason: string | null; latency_ms: number | null; error: string | null;
};
export type RunDetail = Run & { results: Result[] };
export type Comparison = {
  base: { avg_score: number | null; pass_rate: number | null; cases: number };
  candidate: { avg_score: number | null; pass_rate: number | null; cases: number };
  delta: { avg_score: number | null; pass_rate: number | null };
  regressed: CompareEntry[]; improved: CompareEntry[]; unchanged: number;
  base_run: { id: string; prompt: string; prompt_version: number };
  candidate_run: { id: string; prompt: string; prompt_version: number };
};
export type CompareEntry = {
  case_id: string; score_delta: number;
  base: { output: string | null; score: number; passed: boolean };
  candidate: { output: string | null; score: number; passed: boolean };
  case: { idx: number; variables: Record<string, unknown>; expected: string | null } | null;
};

const KEY = 'promptlab_token';
export const getToken = () => (typeof window === 'undefined' ? null : localStorage.getItem(KEY));
export const setToken = (t: string) => localStorage.setItem(KEY, t);
export const clearToken = () => localStorage.removeItem(KEY);
export class UnauthorizedError extends Error {}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), 'x-api-key': getToken() ?? '' },
  });
  const body = await res.json().catch(() => ({}));
  if (res.status === 401) throw new UnauthorizedError();
  if (!res.ok) {
    const d = body.detail;
    throw new Error(typeof d === 'string' ? d : Array.isArray(d) ? d.map((x: { msg: string }) => x.msg).join(', ') : `Request failed (${res.status})`);
  }
  return body as T;
}

export const checkToken = () => request<PromptSummary[]>('/prompts');
export const listPrompts = () => request<PromptSummary[]>('/prompts');
export const getPrompt = (name: string) => request<{ name: string; versions: PromptVersion[] }>(`/prompts/${encodeURIComponent(name)}`);
export const pushVersion = (name: string, v: { template: string; model: string; temperature: number; note?: string }) =>
  request<PromptVersion & { created: boolean }>(`/prompts/${encodeURIComponent(name)}/versions`, { method: 'POST', body: JSON.stringify(v) });
export const listDatasets = () => request<DatasetSummary[]>('/datasets');
export const getDataset = (name: string) => request<{ name: string; version: number; cases: Case[] }>(`/datasets/${encodeURIComponent(name)}`);
export const pushDataset = (name: string, cases: unknown[]) =>
  request<{ version: number; cases: number; created: boolean }>(`/datasets/${encodeURIComponent(name)}/versions`, { method: 'POST', body: JSON.stringify({ cases }) });
export const listRuns = () => request<Run[]>('/runs');
export const getRun = (id: string) => request<RunDetail>(`/runs/${id}`);
export const startRun = (r: { prompt: string; version?: number; dataset: string; scorer: string }) =>
  request<Run>('/runs', { method: 'POST', body: JSON.stringify(r) });
export const compareRuns = (base: string, candidate: string) =>
  request<Comparison>(`/compare?base=${base}&candidate=${candidate}`);

export const pct = (n: number | null) => (n === null ? '–' : `${Math.round(n * 100)}%`);
export const signedPct = (n: number | null) => (n === null ? '–' : `${n > 0 ? '+' : ''}${Math.round(n * 100)}%`);
