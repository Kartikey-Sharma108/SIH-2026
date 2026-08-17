// ============================================================================
// IncidentDetail — Slide-over panel for full log detail
// ============================================================================
// Triggered by clicking a log row
// Fetches GET /api/logs/:id
// Shows full prompt with trigger_words highlighted
// Breakdown: heuristic, guardrail, total score
// Shows block_reason if blocked
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Brain,
  Shield,
  Clock,
  Hash,
  FileText,
  Zap,
  Eye,
} from 'lucide-react';
import { fetchLogById } from '../api';
import RiskBadge from './RiskBadge';

export default function IncidentDetail({ logId, onClose }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!logId) return;

    setLoading(true);
    setError(null);

    fetchLogById(logId)
      .then((data) => {
        setDetail(data);
      })
      .catch((err) => {
        setError(err.response?.data?.error || 'Failed to load incident details');
      })
      .finally(() => setLoading(false));
  }, [logId]);

  // Highlight trigger words in prompt text
  const renderHighlightedPrompt = (prompt, triggerWords) => {
    if (!triggerWords || triggerWords.length === 0) {
      return <span>{prompt}</span>;
    }

    // Parse trigger words — they may be stored as JSON string or array
    let words = triggerWords;
    if (typeof words === 'string') {
      try {
        words = JSON.parse(words);
      } catch {
        words = [words];
      }
    }
    if (!Array.isArray(words) || words.length === 0) {
      return <span>{prompt}</span>;
    }

    // Build regex to match any trigger word (case-insensitive)
    const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`(${escaped.join('|')})`, 'gi');

    const parts = prompt.split(regex);
    return parts.map((part, i) => {
      const isMatch = words.some((w) => w.toLowerCase() === part.toLowerCase());
      return isMatch ? (
        <mark key={i} className="trigger-highlight">
          {part}
        </mark>
      ) : (
        <span key={i}>{part}</span>
      );
    });
  };

  // Score breakdown helpers
  const getHeuristicContrib = (d) => {
    if (d.heuristic_match) return 40;
    return 0;
  };

  const getGuardrailContrib = (d) => {
    if (d.guardrail_error) return 25;
    const label = (d.guardrail_label || '').toUpperCase();
    if (label === 'INJECTION' || label === 'JAILBREAK') return 50;
    if (label === 'BENIGN') return 0;
    return 10;
  };

  if (!logId) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 overlay-backdrop"
        onClick={onClose}
      />

      {/* Slide-over Panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg animate-slide-in">
        <div className="h-full glass-panel-dense rounded-l-2xl overflow-y-auto shadow-2xl shadow-black/50">
          {/* Header */}
          <div className="sticky top-0 z-10 px-6 py-4 border-b border-slate-700/30 bg-slate-900/80 backdrop-blur-xl flex items-center justify-between rounded-tl-2xl">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                <Eye className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-200">Incident Detail</h2>
                <p className="text-xs text-gray-500 font-mono">
                  {logId?.slice(0, 8)}…
                </p>
              </div>
            </div>
            <button
              id="close-incident-detail"
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {loading ? (
              <div className="flex items-center justify-center py-20 gap-3">
                <div className="spinner spinner-lg" />
                <span className="text-sm text-gray-500">Loading detail…</span>
              </div>
            ) : error ? (
              <div className="rounded-xl px-5 py-4 border bg-red-500/8 border-red-500/20">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              </div>
            ) : detail ? (
              <>
                {/* Status & Score */}
                <div className="flex items-center gap-4">
                  {detail.action_taken === 'blocked' ? (
                    <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20">
                      <ShieldAlert className="w-5 h-5 text-red-400" />
                      <span className="text-sm font-semibold text-red-400">Blocked</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                      <ShieldCheck className="w-5 h-5 text-emerald-400" />
                      <span className="text-sm font-semibold text-emerald-400">Allowed</span>
                    </div>
                  )}
                  <RiskBadge score={detail.risk_score} />
                </div>

                {/* Block Reason */}
                {detail.block_reason && (
                  <div className="rounded-xl px-5 py-4 border bg-red-500/8 border-red-500/20">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-red-400 font-medium mb-1">Block Reason</p>
                        <p className="text-sm text-red-300/80 leading-relaxed">
                          {detail.block_reason}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Original Prompt */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="w-4 h-4 text-gray-500" />
                    <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Original Prompt
                    </h3>
                  </div>
                  <div className="rounded-xl p-4 bg-slate-900/60 border border-slate-700/30">
                    <p className="prompt-text whitespace-pre-wrap">
                      {renderHighlightedPrompt(detail.prompt, detail.trigger_words)}
                    </p>
                  </div>
                </div>

                {/* Score Breakdown */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="w-4 h-4 text-gray-500" />
                    <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Score Breakdown
                    </h3>
                  </div>
                  <div className="space-y-3">
                    {/* Heuristic */}
                    <div className="rounded-xl p-4 bg-slate-900/40 border border-slate-700/20">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Brain className="w-4 h-4 text-violet-400" />
                          <span className="text-xs font-medium text-gray-300">
                            Heuristic Layer
                          </span>
                        </div>
                        <span className="text-xs font-mono text-gray-400">
                          {detail.heuristic_match ? 'MATCHED' : 'CLEAN'}
                        </span>
                      </div>
                      <div className="score-bar">
                        <div
                          className="score-bar-fill"
                          style={{
                            width: `${getHeuristicContrib(detail)}%`,
                            background: detail.heuristic_match
                              ? 'linear-gradient(90deg, #EF4444, #F59E0B)'
                              : 'linear-gradient(90deg, #10B981, #34D399)',
                          }}
                        />
                      </div>
                      <p className="text-[10px] text-gray-600 mt-1.5">
                        Contribution: +{getHeuristicContrib(detail)} points
                      </p>
                    </div>

                    {/* Guardrail */}
                    <div className="rounded-xl p-4 bg-slate-900/40 border border-slate-700/20">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-cyan-400" />
                          <span className="text-xs font-medium text-gray-300">
                            Guardrail Layer
                          </span>
                        </div>
                        <span className="text-xs font-mono text-gray-400">
                          {detail.guardrail_label || 'N/A'}
                          {detail.guardrail_confidence != null &&
                            ` (${(detail.guardrail_confidence * 100).toFixed(1)}%)`}
                        </span>
                      </div>
                      <div className="score-bar">
                        <div
                          className="score-bar-fill"
                          style={{
                            width: `${getGuardrailContrib(detail)}%`,
                            background:
                              getGuardrailContrib(detail) > 25
                                ? 'linear-gradient(90deg, #EF4444, #DC2626)'
                                : getGuardrailContrib(detail) > 0
                                ? 'linear-gradient(90deg, #F59E0B, #EAB308)'
                                : 'linear-gradient(90deg, #10B981, #34D399)',
                          }}
                        />
                      </div>
                      <p className="text-[10px] text-gray-600 mt-1.5">
                        Contribution: +{getGuardrailContrib(detail)} points
                      </p>
                      {detail.guardrail_error && (
                        <p className="text-[10px] text-amber-400 mt-1">
                          ⚠ Error: {detail.guardrail_error}
                        </p>
                      )}
                    </div>

                    {/* Total */}
                    <div className="rounded-xl p-4 bg-cyan-500/5 border border-cyan-500/15">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-300">Total Risk Score</span>
                        <span className="text-lg font-bold font-mono text-cyan-400">
                          {detail.risk_score}
                          <span className="text-xs text-gray-500 font-normal">/100</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Metadata */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Hash className="w-4 h-4 text-gray-500" />
                    <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Metadata
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg p-3 bg-slate-900/40 border border-slate-700/20">
                      <p className="text-[10px] text-gray-600 uppercase mb-1">Timestamp</p>
                      <p className="text-xs text-gray-300 font-mono">
                        {new Date(detail.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="rounded-lg p-3 bg-slate-900/40 border border-slate-700/20">
                      <p className="text-[10px] text-gray-600 uppercase mb-1">Processing</p>
                      <p className="text-xs text-gray-300 font-mono">
                        {detail.processing_ms != null ? `${detail.processing_ms}ms` : '—'}
                      </p>
                    </div>
                    <div className="rounded-lg p-3 bg-slate-900/40 border border-slate-700/20">
                      <p className="text-[10px] text-gray-600 uppercase mb-1">Log ID</p>
                      <p className="text-xs text-gray-300 font-mono break-all">
                        {detail.id}
                      </p>
                    </div>
                    <div className="rounded-lg p-3 bg-slate-900/40 border border-slate-700/20">
                      <p className="text-[10px] text-gray-600 uppercase mb-1">Source IP</p>
                      <p className="text-xs text-gray-300 font-mono">
                        {detail.source_ip || '—'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* LLM Response (if allowed) */}
                {detail.llm_response && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Brain className="w-4 h-4 text-gray-500" />
                      <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                        LLM Response
                      </h3>
                    </div>
                    <div className="rounded-xl p-4 bg-slate-900/60 border border-slate-700/30">
                      <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                        {detail.llm_response}
                      </p>
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
