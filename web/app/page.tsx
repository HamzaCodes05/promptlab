'use client';
import { useCallback, useEffect, useState } from 'react';
import ComparePanel from '@/components/ComparePanel';
import DatasetsPanel from '@/components/DatasetsPanel';
import LoginForm from '@/components/LoginForm';
import PromptsPanel from '@/components/PromptsPanel';
import RunsPanel from '@/components/RunsPanel';
import { Run, UnauthorizedError, clearToken, getToken, listRuns } from '@/lib/api';

const TABS = ['Prompts', 'Datasets', 'Runs', 'Compare'] as const;

export default function Home() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<(typeof TABS)[number]>('Runs');
  const [runs, setRuns] = useState<Run[]>([]);

  const refresh = useCallback(async () => {
    try {
      setRuns(await listRuns());
    } catch (err) {
      if (err instanceof UnauthorizedError) { clearToken(); setAuthed(false); }
    }
  }, []);

  useEffect(() => { setAuthed(!!getToken()); setReady(true); }, []);
  useEffect(() => {
    if (!authed) return;
    refresh();
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [authed, refresh]);

  if (!ready) return null;
  if (!authed) return <LoginForm onDone={() => setAuthed(true)} />;

  return (
    <div className="mx-auto max-w-6xl p-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">PromptLab</h1>
        <nav className="flex gap-1">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`rounded-lg px-3 py-1.5 text-sm ${tab === t ? 'bg-slate-800' : 'text-slate-400 hover:text-slate-200'}`}>{t}</button>
          ))}
        </nav>
        <button onClick={() => { clearToken(); setAuthed(false); }} className="text-sm text-slate-400 hover:text-slate-200">Sign out</button>
      </header>
      {tab === 'Prompts' && <PromptsPanel />}
      {tab === 'Datasets' && <DatasetsPanel />}
      {tab === 'Runs' && <RunsPanel runs={runs} refresh={refresh} />}
      {tab === 'Compare' && <ComparePanel runs={runs} />}
    </div>
  );
}
