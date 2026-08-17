// ============================================================================
// App.jsx — AI Security Gateway Dashboard Layout
// ============================================================================

import React, { useState } from 'react';
import {
  ShieldCheck,
  Activity,
  Terminal,
  Github,
  ExternalLink,
} from 'lucide-react';
import PromptInput from './components/PromptInput';
import LogTable from './components/LogTable';
import IncidentDetail from './components/IncidentDetail';

export default function App() {
  const [selectedLogId, setSelectedLogId] = useState(null);

  return (
    <div className="min-h-screen bg-[#0B1120] bg-grid relative">
      {/* Ambient glow effects */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-violet-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Navbar */}
      <nav className="sticky top-0 z-30 border-b border-slate-800/60 bg-[#0B1120]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500/20 to-violet-500/20 border border-cyan-500/20">
                <ShieldCheck className="w-6 h-6 text-cyan-400" />
              </div>
              <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-[#0B1120]" />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-100 tracking-tight">
                AI Security Gateway
              </h1>
              <p className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">
                Prompt Analysis Dashboard
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Connection Status */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700/30">
              <div className="status-dot status-dot-green" />
              <span className="text-xs text-gray-400 font-mono">
                localhost:3001
              </span>
            </div>

            {/* Version Badge */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-violet-500/10 border border-violet-500/20">
              <Terminal className="w-3 h-3 text-violet-400" />
              <span className="text-[10px] text-violet-400 font-mono font-medium">v1.0.0</span>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Prompt Input Section */}
        <PromptInput />

        {/* Log Table Section */}
        <LogTable onSelectLog={(id) => setSelectedLogId(id)} />
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-6 py-6 mt-4">
        <div className="flex items-center justify-between text-xs text-gray-600">
          <span className="font-mono">AI Security Gateway · SIH 2026</span>
          <div className="flex items-center gap-4">
            <span className="font-mono">
              Backend: {import.meta.env.VITE_API_URL || 'http://localhost:3001'}
            </span>
          </div>
        </div>
      </footer>

      {/* Incident Detail Slide-over */}
      {selectedLogId && (
        <IncidentDetail
          logId={selectedLogId}
          onClose={() => setSelectedLogId(null)}
        />
      )}
    </div>
  );
}
