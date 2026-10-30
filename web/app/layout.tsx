import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PromptLab: prompt versioning and evals',
  description: 'Version prompts, run evals, catch regressions before they ship.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
