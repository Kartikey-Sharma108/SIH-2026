// ============================================================================
// LogTable — Live security logs with polling
// ============================================================================
// Polls GET /api/logs every 2 seconds
// Columns: timestamp, truncated prompt, risk score, action
// Click row to open IncidentDetail
// Flash animation on new rows
// ============================================================================

import React, { useState, useEffect, useRef } from 'react';
import { Activity, Clock, FileText, ShieldAlert, ShieldCheck, RefreshCw } from 'lucide-react';
import { fetchLogs } from '../api';
import RiskBadge from './RiskBadge';

export default function LogTable({ onSelectLog }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newIds, setNewIds] = useState(new Set());
  const prevIdsRef = useRef(new Set());
  const pollRef = useRef(null);

  // Format timestamp to a readable short form
  const formatTime = (ts) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  const formatDate = (ts) => {
    const d = new Date(ts);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  // Truncate prompt to maxLen chars
  const truncate = (str, maxLen = 60) => {
    if (!str) return '—';
    return str.length > maxLen ? str.slice(0, maxLen) + '…' : str;
  };

  // Poll for logs
  useEffect(() => {
    const poll = async () => {
      try {
        const data = await fetchLogs(50);
        const incoming = data.logs || [];

        // Detect new rows
        const currentIds = new Set(incoming.map((l) => l.id));
        const freshIds = new Set();
        currentIds.forEach((id) => {
          if (!prevIdsRef.current.has(id)) {
            freshIds.add(id);
          }
        });

        if (freshIds.size > 0 && prevIdsRef.current.size > 0) {
          setNewIds(freshIds);
          // Clear flash after animation
          setTimeout(() => setNewIds(new Set()), 1500);
        }

        prevIdsRef.current = currentIds;
        setLogs(incoming);
        setError(null);
      } catch (err) {
        setError('Unable to fetch logs');
      } finally {
        setLoading(false);
      }
    };

    poll();
    pollRef.current = setInterval(poll, 2000);
    return () => clearInterval(pollRef.current);
  }, []);

  return (
    <div className="glass-panel overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-700/30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-violet-500/10 border border-violet-500/20">
            <Activity className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-200">Security Logs</h2>
            <p className="text-xs text-gray-500">
              {logs.length} entries · polling every 2s
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`status-dot ${error ? 'status-dot-red' : 'status-dot-green'}`} />
          <span className="text-xs text-gray-500">{error ? 'Disconnected' : 'Live'}</span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        {loading && logs.length === 0 ? (
          <div className="flex items-center justify-center py-16 gap-3">
            <div className="spinner" />
            <span className="text-sm text-gray-500">Loading logs…</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <ShieldCheck className="w-10 h-10 text-gray-700" />
            <p className="text-sm text-gray-500">No security events yet</p>
            <p className="text-xs text-gray-600">Submit a prompt above to generate log entries</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/30">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    Timestamp
                  </div>
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    Prompt
                  </div>
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Risk
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Latency
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {logs.map((log) => (
                <tr
                  key={log.id}
                  id={`log-row-${log.id}`}
                  onClick={() => onSelectLog(log.id)}
                  className={`
                    log-row cursor-pointer
                    ${newIds.has(log.id) ? 'animate-flash-row' : ''}
                  `}
                >
                  <td className="px-6 py-3 whitespace-nowrap">
                    <div className="flex flex-col">
                      <span className="text-gray-300 font-mono text-xs">
                        {formatTime(log.created_at)}
                      </span>
                      <span className="text-gray-600 text-[10px]">
                        {formatDate(log.created_at)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <span className="text-gray-400 font-mono text-xs">
                      {truncate(log.prompt)}
                    </span>
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap">
                    <RiskBadge score={log.risk_score} />
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap">
                    {log.action_taken === 'blocked' ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-400">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        Blocked
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Allowed
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap text-right">
                    <span className="text-gray-500 font-mono text-xs">
                      {log.processing_ms != null ? `${log.processing_ms}ms` : '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
