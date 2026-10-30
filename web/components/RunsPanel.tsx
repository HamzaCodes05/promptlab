'use client';
import { useEffect, useState } from 'react';
import {
  DatasetSummary, PromptSummary, Run, RunDetail, getRun, listDatasets, listPrompts, pct, startRun,
} from '@/lib/api';

const input = 'rounded-lg bg-slate-800 px-3 py-2 text-sm outline-none focus:ring-2 ring-violet-500';
const SCORERS = ['exact_match', 'contains', 'regex', 'json_valid', 'llm_judge'];
const STATUS: Record<string, string> = {
  queued: 'bg-slate-700 text-slate-200', running: 'bg-amber-500/20 text-amber-300',
  completed: 'bg-emerald-500/20 text-emerald-300', failed: 'bg-red-500/20 text-red-300',
};

export default function RunsPanel({ runs, refresh }: { runs: Run[]; refresh: () => void }) {
  const [prompts, setPrompts] = useState<PromptSummary[]>([]);
  const [datasets, setDatasets] = useState<DatasetSummary[]>([]);
  const [form, setForm] = useState({ prompt: '', version: '', dataset: '', scorer: 'exact_match' });
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<RunDetail | null>(null);
  const [onlyFailed, setOnlyFailed] = useState(false);

  useEffect(() => {
    listPrompts().then((p) => { setPrompts(p); setForm((f) => ({ ...f, prompt: f.prompt || p[0]?.name || '' })); }).catch(() => undefined);
    listDatasets().then((d) => { setDatasets(d); setForm((f) => ({ ...f, dataset: f.dataset || d[0]?.name || '' })); }).catch(() => undefined);
  }, []);

  // keep the open detail fresh while its run is in flight
  useEffect(() => {
    if (!detail || detail.status === 'completed' || detail.status === 'failed') return;
    const t = setInterval(() => getRun(detail.id).then(setDetail).catch(() => undefined), 1500);
    return () => clearInterval(t);
  }, [detail]);

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const r = await startRun({ prompt: form.prompt, dataset: form.dataset, scorer: form.scorer, ...(form.version ? { version: Number(form.version) } : {}) });
      refresh();
      setDetail(await getRun(r.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  const shown = detail?.results.filter((r) => !onlyFailed || !r.passed) ?? [];
  return (
    <div className="space-y-6">
      <form onSubmit={start} className="flex flex-wrap items-end gap-3 rounded-xl bg-slate-900 p-4">
        <label className="text-xs text-slate-400">Prompt
          <select className={`${input} mt-1 block`} value={form.prompt} onChange={(e) => setForm({ ...form, prompt: e.target.value })}>
            {prompts.map((p) => <option key={p.name}>{p.name}</option>)}
          </select></label>
        <label className="text-xs text-slate-400">Version
          <input className={`${input} mt-1 block w-24`} type="number" min={1} placeholder="latest" value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} /></label>
        <label className="text-xs text-slate-400">Dataset
          <select className={`${input} mt-1 block`} value={form.dataset} onChange={(e) => setForm({ ...form, dataset: e.target.value })}>
            {datasets.map((d) => <option key={d.name}>{d.name}</option>)}
          </select></label>
        <label className="text-xs text-slate-400">Scorer
          <select className={`${input} mt-1 block`} value={form.scorer} onChange={(e) => setForm({ ...form, scorer: e.target.value })}>
            {SCORERS.map((s) => <option key={s}>{s}</option>)}
          </select></label>
        <button className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium hover:bg-violet-500">Run eval</button>
        {error && <p className="w-full text-sm text-red-400">{error}</p>}
      </form>

      <div className="overflow-x-auto rounded-xl bg-slate-900">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-slate-500">
            <tr><th className="p-3">Prompt</th><th>Dataset</th><th>Scorer</th><th>Status</th><th>Pass rate</th><th>Avg latency</th><th>Started</th></tr>
          </thead>
          <tbody>
            {runs.length === 0 && <tr><td className="p-3 text-slate-500" colSpan={7}>No runs yet.</td></tr>}
            {runs.map((r) => (
              <tr key={r.id} onClick={() => getRun(r.id).then(setDetail)}
                className={`cursor-pointer border-t border-slate-800 hover:bg-slate-800/60 ${detail?.id === r.id ? 'bg-slate-800' : ''}`}>
                <td className="p-3">{r.prompt} <span className="text-violet-300">v{r.prompt_version}</span></td>
                <td>{r.dataset} v{r.dataset_version}</td>
                <td className="font-mono text-xs">{r.scorer}</td>
                <td><span className={`rounded-full px-2 py-0.5 text-xs ${STATUS[r.status]}`}>{r.status}{r.status === 'running' && ` ${r.completed}/${r.total}`}</span></td>
                <td className={r.pass_rate !== null && r.pass_rate < 0.9 ? 'text-orange-300' : ''}>{pct(r.pass_rate)}</td>
                <td>{r.avg_latency_ms === null ? '–' : `${Math.round(r.avg_latency_ms)} ms`}</td>
                <td className="text-slate-400">{new Date(r.created_at).toLocaleTimeString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detail && (
        <div className="overflow-x-auto rounded-xl bg-slate-900">
          <div className="flex flex-wrap items-center gap-4 p-3 text-sm">
            <span className="font-medium">{detail.prompt} v{detail.prompt_version} on {detail.dataset} v{detail.dataset_version}</span>
            <span className="text-slate-400">{detail.model}</span>
            <span className="text-slate-400">pass {pct(detail.pass_rate)} · {detail.completed}/{detail.total} cases</span>
            {detail.error && <span className="text-red-400">{detail.error}</span>}
            <label className="ml-auto flex items-center gap-2 text-xs text-slate-400">
              <input type="checkbox" checked={onlyFailed} onChange={(e) => setOnlyFailed(e.target.checked)} /> failures only
            </label>
          </div>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500"><tr><th className="p-3">#</th><th>Input</th><th>Expected</th><th>Output</th><th>Score</th></tr></thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.case_id} className="border-t border-slate-800 align-top" title={r.reason ?? undefined}>
                  <td className="p-3 text-slate-500">{r.idx}</td>
                  <td className="max-w-xs font-mono text-xs text-slate-400">{JSON.stringify(r.variables)}</td>
                  <td>{r.expected}</td>
                  <td className="max-w-sm">{r.error ? <span className="text-red-400">{r.error}</span> : r.output}</td>
                  <td className={r.passed ? 'text-emerald-400' : 'text-red-400'}>{r.passed ? 'pass' : 'fail'} <span className="text-slate-500">{r.score.toFixed(2)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
