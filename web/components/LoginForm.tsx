'use client';
import { useState } from 'react';
import { checkToken, setToken } from '@/lib/api';

export default function LoginForm({ onDone }: { onDone: () => void }) {
  const [token, setTok] = useState('');
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setToken(token);
    try {
      await checkToken();
      onDone();
    } catch {
      localStorage.removeItem('promptlab_token');
      setError('Could not authenticate. Check the token and that the API is running.');
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl bg-slate-900 p-6 shadow-xl">
        <div>
          <h1 className="text-2xl font-semibold">PromptLab</h1>
          <p className="text-sm text-slate-400">Version prompts. Run evals. Catch regressions.</p>
        </div>
        <input type="password" required value={token} onChange={(e) => setTok(e.target.value)} placeholder="API token"
          className="w-full rounded-lg bg-slate-800 px-3 py-2 outline-none focus:ring-2 ring-violet-500" />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button className="w-full rounded-lg bg-violet-600 py-2 font-medium hover:bg-violet-500">Continue</button>
      </form>
    </main>
  );
}
