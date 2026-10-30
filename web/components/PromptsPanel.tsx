'use client';
import { useCallback, useEffect, useState } from 'react';
import { PromptSummary, PromptVersion, getPrompt, listPrompts, pushVersion } from '@/lib/api';

const input = 'w-full rounded-lg bg-slate-800 px-3 py-2 text-sm outline-none focus:ring-2 ring-violet-500';

export default function PromptsPanel() {
  const [prompts, setPrompts] = useState<PromptSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [form, setForm] = useState({ name: '', template: '', model: 'mock-classifier', temperature: '0', note: '' });
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const load = useCallback(async () => setPrompts(await listPrompts()), []);
  useEffect(() => { load().catch(() => undefined); }, [load]);
  useEffect(() => { if (selected) getPrompt(selected).then((p) => setVersions(p.versions)).catch(() => undefined); }, [selected]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setInfo('');
    try {
      const v = await pushVersion(form.name, { template: form.template, model: form.model, temperature: Number(form.temperature), note: form.note || undefined });
      setInfo(v.created ? `Created ${form.name} v${v.version}` : `No change: identical to v${v.version}`);
      await load();
      setSelected(form.name);
      getPrompt(form.name).then((p) => setVersions(p.versions));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
      <div className="space-y-2">
        {prompts.length === 0 && <p className="text-sm text-slate-500">No prompts yet.</p>}
        {prompts.map((p) => (
          <button key={p.name} onClick={() => setSelected(p.name)}
            className={`w-full rounded-lg p-3 text-left ${selected === p.name ? 'bg-slate-700' : 'bg-slate-900 hover:bg-slate-800'}`}>
            <p className="font-medium">{p.name}</p>
            <p className="text-xs text-slate-400">{p.versions} version{p.versions === 1 ? '' : 's'}, latest v{p.latest_version}</p>
          </button>
        ))}
      </div>

      <div className="space-y-6">
        <form onSubmit={submit} className="space-y-3 rounded-xl bg-slate-900 p-4">
          <p className="text-sm font-medium">Push a new version <span className="font-normal text-slate-500">(creates the prompt if needed; use {'{{variable}}'} placeholders)</span></p>
          <div className="grid gap-3 sm:grid-cols-3">
            <input className={input} required placeholder="prompt name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className={input} required placeholder="model" list="models" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
            <input className={input} type="number" step="0.1" min="0" max="1" value={form.temperature} onChange={(e) => setForm({ ...form, temperature: e.target.value })} />
          </div>
          <datalist id="models"><option value="mock-classifier" /><option value="claude-haiku-5-5" /><option value="claude-sonnet-5-5" /></datalist>
          <textarea className={`${input} font-mono`} rows={5} required placeholder="Template, e.g. Classify: {{review}}" value={form.template} onChange={(e) => setForm({ ...form, template: e.target.value })} />
          <input className={input} placeholder="note (what changed and why)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          {error && <p className="text-sm text-red-400">{error}</p>}
          {info && <p className="text-sm text-emerald-400">{info}</p>}
          <button className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium hover:bg-violet-500">Push version</button>
        </form>

        {selected && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">{selected}</h2>
            {versions.map((v) => (
              <div key={v.id} className="rounded-xl bg-slate-900 p-4">
                <div className="mb-2 flex flex-wrap items-center gap-3 text-sm">
                  <span className="rounded bg-violet-600/30 px-2 py-0.5 font-medium text-violet-200">v{v.version}</span>
                  <span className="font-mono text-slate-300">{v.model}</span>
                  <span className="text-slate-500">temp {v.temperature}</span>
                  <span className="text-slate-500">vars: {v.variables.join(', ') || 'none'}</span>
                  <span className="ml-auto text-xs text-slate-500">{new Date(v.created_at).toLocaleString()}</span>
                </div>
                {v.note && <p className="mb-2 text-sm text-slate-400">{v.note}</p>}
                <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-slate-950 p-3 text-xs text-slate-300">{v.template}</pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
