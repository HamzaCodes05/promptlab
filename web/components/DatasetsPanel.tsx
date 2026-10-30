'use client';
import { useCallback, useEffect, useState } from 'react';
import { Case, DatasetSummary, getDataset, listDatasets, pushDataset } from '@/lib/api';

const input = 'w-full rounded-lg bg-slate-800 px-3 py-2 text-sm outline-none focus:ring-2 ring-violet-500';
const PLACEHOLDER = '{"variables": {"review": "Great product!"}, "expected": "positive"}\n{"variables": {"review": "Broke in a day."}, "expected": "negative"}';

export default function DatasetsPanel() {
  const [datasets, setDatasets] = useState<DatasetSummary[]>([]);
  const [selected, setSelected] = useState<{ name: string; version: number; cases: Case[] } | null>(null);
  const [name, setName] = useState('');
  const [jsonl, setJsonl] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const load = useCallback(async () => setDatasets(await listDatasets()), []);
  useEffect(() => { load().catch(() => undefined); }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setInfo('');
    try {
      const cases = jsonl.split('\n').filter((l) => l.trim()).map((l, i) => {
        try { return JSON.parse(l); } catch { throw new Error(`Line ${i + 1} is not valid JSON`); }
      });
      const r = await pushDataset(name, cases);
      setInfo(r.created ? `Created ${name} v${r.version} (${r.cases} cases)` : `No change: identical to v${r.version}`);
      await load();
      setSelected(await getDataset(name));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
      <div className="space-y-2">
        {datasets.length === 0 && <p className="text-sm text-slate-500">No datasets yet.</p>}
        {datasets.map((d) => (
          <button key={d.name} onClick={() => getDataset(d.name).then(setSelected)}
            className={`w-full rounded-lg p-3 text-left ${selected?.name === d.name ? 'bg-slate-700' : 'bg-slate-900 hover:bg-slate-800'}`}>
            <p className="font-medium">{d.name}</p>
            <p className="text-xs text-slate-400">{d.versions} version{d.versions === 1 ? '' : 's'}, latest v{d.latest_version}</p>
          </button>
        ))}
      </div>
      <div className="space-y-6">
        <form onSubmit={submit} className="space-y-3 rounded-xl bg-slate-900 p-4">
          <p className="text-sm font-medium">Push a dataset version <span className="font-normal text-slate-500">(JSON Lines: one case per line)</span></p>
          <input className={input} required placeholder="dataset name" value={name} onChange={(e) => setName(e.target.value)} />
          <textarea className={`${input} font-mono`} rows={6} required placeholder={PLACEHOLDER} value={jsonl} onChange={(e) => setJsonl(e.target.value)} />
          {error && <p className="text-sm text-red-400">{error}</p>}
          {info && <p className="text-sm text-emerald-400">{info}</p>}
          <button className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium hover:bg-violet-500">Push dataset</button>
        </form>
        {selected && (
          <div className="overflow-x-auto rounded-xl bg-slate-900">
            <p className="p-3 text-sm font-medium">{selected.name} v{selected.version}: {selected.cases.length} cases</p>
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-slate-500"><tr><th className="p-3">#</th><th>Variables</th><th>Expected</th></tr></thead>
              <tbody>
                {selected.cases.map((c) => (
                  <tr key={c.id} className="border-t border-slate-800 align-top">
                    <td className="p-3 text-slate-500">{c.idx}</td>
                    <td className="font-mono text-xs">{JSON.stringify(c.variables)}</td>
                    <td>{c.expected}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
