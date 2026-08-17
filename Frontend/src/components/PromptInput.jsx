// ============================================================================
// PromptInput — Textarea + "Analyze" button
// ============================================================================
// Posts to POST /api/analyze
// Shows loading spinner during guardrail call
// Inline result banner: green "Passed" or red "Blocked"
// ============================================================================

import React, { useState } from 'react';
import { Shield, Send, Loader2, CheckCircle2, XOctagon, AlertTriangle } from 'lucide-react';
import { analyzePrompt } from '../api';
import RiskBadge from './RiskBadge';

export default function PromptInput() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleAnalyze = async () => {
    if (!prompt.trim() || loading) return;

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const data = await analyzePrompt(prompt.trim());
      setResult(data);
    } catch (err) {
      setError(
        err.response?.data?.error || 'Failed to reach the gateway. Is the backend running?'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleAnalyze();
    }
  };

  return (
    <div className="glass-panel p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
          <Shield className="w-5 h-5 text-cyan-400" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-gray-200">Prompt Analysis</h2>
          <p className="text-xs text-gray-500">Submit a prompt to analyze through the security gateway</p>
        </div>
      </div>

      {/* Textarea */}
      <div className="relative">
        <textarea
          id="prompt-input"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter a prompt to analyze for security threats..."
          disabled={loading}
          rows={4}
          className="
            w-full px-4 py-3 rounded-xl
            bg-slate-900/60 border border-slate-700/50
            text-gray-200 placeholder-gray-600
            font-mono text-sm leading-relaxed
            resize-none
            focus:outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20
            transition-all duration-200
            disabled:opacity-50 disabled:cursor-not-allowed
          "
        />
        <div className="absolute bottom-3 right-3 text-xs text-gray-600 font-mono">
          {prompt.length} chars
        </div>
      </div>

      {/* Analyze Button */}
      <div className="flex items-center gap-3">
        <button
          id="analyze-button"
          onClick={handleAnalyze}
          disabled={!prompt.trim() || loading}
          className="
            flex items-center gap-2 px-5 py-2.5
            rounded-xl font-medium text-sm
            bg-gradient-to-r from-cyan-600 to-cyan-500
            hover:from-cyan-500 hover:to-cyan-400
            text-white shadow-lg shadow-cyan-500/20
            disabled:opacity-40 disabled:cursor-not-allowed
            disabled:hover:from-cyan-600 disabled:hover:to-cyan-500
            transition-all duration-200
            active:scale-[0.98]
          "
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Analyzing…
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Analyze
            </>
          )}
        </button>

        {loading && (
          <span className="text-xs text-gray-500 animate-pulse">
            Running guardrail checks — this may take up to 15s…
          </span>
        )}
      </div>

      {/* Result Banner */}
      {result && (
        <div
          className={`
            result-banner rounded-xl px-5 py-4 border
            ${
              result.blocked
                ? 'bg-red-500/8 border-red-500/20'
                : 'bg-emerald-500/8 border-emerald-500/20'
            }
          `}
        >
          <div className="flex items-start gap-3">
            {result.blocked ? (
              <XOctagon className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
            )}
            <div className="space-y-2 flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <span
                  className={`font-semibold text-sm ${
                    result.blocked ? 'text-red-400' : 'text-emerald-400'
                  }`}
                >
                  {result.blocked ? '🚫 Denied' : '✅ Passed'}
                </span>
                <RiskBadge score={result.riskScore} />
              </div>

              {result.blocked && result.reason && (
                <p className="text-xs text-red-300/70 leading-relaxed">
                  <span className="text-red-400 font-medium">Reason: </span>
                  {result.reason}
                </p>
              )}

              {result.blocked && result.triggerWords?.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-xs text-gray-500">Triggers:</span>
                  {result.triggerWords.map((w, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-md bg-red-500/10 text-red-400 text-xs font-mono border border-red-500/20"
                    >
                      {w}
                    </span>
                  ))}
                </div>
              )}

              {!result.blocked && result.response && (
                <div className="mt-2 p-3 rounded-lg bg-slate-900/50 border border-slate-700/30">
                  <p className="text-xs text-gray-500 mb-1 font-medium">LLM Response:</p>
                  <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {result.response}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="result-banner rounded-xl px-5 py-4 border bg-red-500/8 border-red-500/20">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
