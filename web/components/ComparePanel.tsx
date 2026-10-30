'use client';
import { useState } from 'react';
import { CompareEntry, Comparison, Run, compareRuns, pct, signedPct } from '@/lib/api';

const select = 'rounded-lg bg-slate-800 px-3 py-2 text-sm outline-none focus:ring-2 ring-violet-500';
const label = (r: Run) => `${r.prompt} v${r.prompt_version} · ${r.dataset} v${r.dataset_version} · ${pct(r.pass_rate)} · ${new Date(r.created_at).toLocaleTimeString()}`;

function Entries({ title, tone, entries }: { title: string; tone: string; entries: CompareEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <div className="overflow-x-auto rounded-xl bg-slate-900">
      <p className={`p-3 text-sm font-medium ${tone}`}>{title} ({entries.length})</p>
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase text-slate-500"><tr><th className="p-3">#</th><th>Input</th><th>Expected</th><th>Base output</th><th>Candidate output</th></tr></thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.case_id} className="border-t border-slate-800 align-top">
              <td className="p-3 text-slate-500">{e.case?.idx}</td>
              <td className="max-w-xs font-mono text-xs text-slate-400">{JSON.stringify(e.case?.variables)}</td>
              <td>{e.case?.expected}</td>
              <td className="max-w-xs">{e.base.output}</td>
              <td className="max-w-xs">{e.candidate.output}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ComparePanel({ runs }: { runs: Run[] }) {
  const done = runs.filter((r) => r.status === 'completed');
  const [base, setBase] = useState('');
  const [cand, setCand] = useState('');
  const [result, setResult] = useState<Comparison | null>(null);
  const [error, setError] = useState('');

  async function go() {
    setError(''); setResult(null);
    try { setResult(await compareRuns(base, cand)); } catch (err) { setError(err instanceof Error ? err.message : 'Failed'); }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3 rounded-xl bg-slate-900 p-4">
        <label className="text-xs text-slate-400">Base (before)
          <select className={`${select} mt-1 block`} value={base} onChange={(e) => setBase(e.target.value)}>
            <option value="">Select a run</option>{done.map((r) => <option key={r.id} value={r.id}>{label(r)}</option>)}
          </select></label>
        <label className="text-xs text-slate-400">Candidate (after)
          <select className={`${select} mt-1 block`} value={cand} onChange={(e) => setCand(e.target.value)}>
            <option value="">Select a run</option>{done.map((r) => <option key={r.id} value={r.id}>{label(r)}</option>)}
          </select></label>
        <button disabled={!base || !cand} onClick={go} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium hover:bg-violet-500 disabled:opacity-50">Compare</button>
        {error && <p className="w-full text-sm text-red-400">{error}</p>}
      </div>

      {result && (
        <>
          <div className="grid gap-4 sm:grid-cols-4">
            {[
              ['Base pass rate', pct(result.base.pass_rate), `${result.base_run.prompt} v${result.base_run.prompt_version}`],
              ['Candidate pass rate', pct(result.candidate.pass_rate), `${result.candidate_run.prompt} v${result.candidate_run.prompt_version}`],
              ['Change', signedPct(result.delta.pass_rate), 'pass rate'],
              ['Cases', `${result.improved.length} better · ${result.regressed.length} worse`, `${result.unchanged} unchanged`],
            ].map(([k, v, sub]) => (
              <div key={k} className="rounded-xl bg-slate-900 p-4">
                <p className="text-xs uppercase text-slate-500">{k}</p>
                <p className={`mt-1 text-2xl font-semibold ${k === 'Change' && (result.delta.pass_rate ?? 0) < 0 ? 'text-red-400' : k === 'Change' && (result.delta.pass_rate ?? 0) > 0 ? 'text-emerald-400' : ''}`}>{v}</p>
                <p className="text-xs text-slate-400">{sub}</p>
              </div>
            ))}
          </div>
          <Entries title="Regressions: passed before, fails now" tone="text-red-400" entries={result.regressed} />
          <Entries title="Improvements: failed before, passes now" tone="text-emerald-400" entries={result.improved} />
        </>
      )}
    </div>
  );
}
