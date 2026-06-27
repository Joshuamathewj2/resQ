/**
 * @file src/components/IncidentTimeline.tsx
 * @description Incident log timeline with dual-tab view.
 *
 * Provides two views:
 * - **Active Session Logs**: Live chronological log stream from the Zustand store.
 *   Each entry is colour-coded by type (INFO, WARNING, ALERT, ERROR, DECISION, ACTION).
 *   Supports inline camera frame thumbnails and foldable detail blocks.
 * - **IndexedDB Archive**: Historical incident records persisted to browser storage.
 *   Supports deletion and expandable full timelines per incident.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useAgentStore } from '../store/agentStore';
import { getAllIncidents, deleteIncident, IncidentRecord } from '../services/incidentLogger';
import { FileText, Calendar, Trash2 } from 'lucide-react';
import { IncidentLog } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// PURE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determines the display icon and accent colour for a log entry based on
 * its message content and type classification.
 *
 * @param message - The log entry message string
 * @param type - The IncidentLog type field
 * @returns Object with emoji icon and hex colour string
 */
function getLogStyle(message: string, type: IncidentLog['type']): { icon: string; color: string } {
  if (
    message.includes('⚡') ||
    message.includes('🚨') ||
    type === 'ALERT'
  ) {
    return { icon: '⚡', color: '#f43f5e' };
  }
  if (message.includes('ERROR') || type === 'ERROR') {
    return { icon: '❌', color: '#ef4444' };
  }
  if (message.includes('🎥') || message.includes('📸') || message.includes('📷')) {
    return { icon: '🎥', color: '#38bdf8' };
  }
  if (
    message.includes('🤖') ||
    message.includes('Gemini') ||
    type === 'DECISION'
  ) {
    return { icon: '🤖', color: '#a5b4fc' };
  }
  if (
    message.includes('📡') ||
    message.includes('dispatched') ||
    message.includes('SMS') ||
    type === 'ACTION'
  ) {
    return { icon: '📡', color: '#f59e0b' };
  }
  if (
    message.includes('⚠️') ||
    message.includes('Impact') ||
    type === 'WARNING'
  ) {
    return { icon: '⚠️', color: '#fbbf24' };
  }
  if (message.includes('✅') || message.includes('🟢') || message.includes('safe')) {
    return { icon: '✅', color: '#10b981' };
  }
  return { icon: 'ℹ️', color: '#38bdf8' };
}

/**
 * Formats an ISO 8601 timestamp string into a short HH:MM:SS time string.
 *
 * @param isoString - ISO timestamp string
 * @returns Formatted time string or empty string on parse error
 */
function formatLogTime(isoString: string): string {
  try {
    return new Date(isoString).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dual-tab incident timeline component.
 *
 * - Tab 1: Displays live logs from Zustand store with colour coding and thumbnails
 * - Tab 2: Displays archived incidents from IndexedDB with expandable detail view
 *
 * @example
 * ```tsx
 * <IncidentTimeline />
 * ```
 */
export const IncidentTimeline: React.FC = () => {
  const { logs } = useAgentStore();
  const [archivedIncidents, setArchivedIncidents] = useState<IncidentRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');

  /**
   * Loads all incident records from IndexedDB into component state.
   */
  const loadHistory = useCallback(async () => {
    const list = await getAllIncidents();
    setArchivedIncidents(list);
  }, []);

  useEffect(() => {
    if (activeTab === 'history') {
      void loadHistory();
    }
  }, [activeTab, logs, loadHistory]);

  /**
   * Deletes an incident record from IndexedDB after user confirmation.
   *
   * @param id - The incident ID to delete
   */
  const handleDeleteHistory = async (id: string) => {
    if (confirm('Delete this incident history permanently?')) {
      await deleteIncident(id);
      void loadHistory();
    }
  };

  return (
    <div className="timeline-card" id="incident-timeline">
      {/* Tab Row */}
      <div className="tab-row">
        <button
          id="tab-active-logs"
          onClick={() => setActiveTab('current')}
          className={`tab-btn ${activeTab === 'current' ? 'tab-btn-active' : ''}`}
        >
          <FileText className="w-4 h-4" />
          <span>Active Session Logs ({logs.length})</span>
        </button>
        <button
          id="tab-history"
          onClick={() => setActiveTab('history')}
          className={`tab-btn ${activeTab === 'history' ? 'tab-btn-active' : ''}`}
        >
          <Calendar className="w-4 h-4" />
          <span>IndexedDB Archive ({archivedIncidents.length})</span>
        </button>
      </div>

      {/* ── Active Session Log View ─────────────────────────────────────────── */}
      {activeTab === 'current' ? (
        <div className="logs-scroller" aria-label="Active session log entries">
          {logs.length === 0 ? (
            <div className="empty-logs">
              Console is idle. Logs will populate here upon activity.
            </div>
          ) : (
            logs.map(logEntry => {
              const { icon, color } = getLogStyle(logEntry.message, logEntry.type);
              return (
                <div
                  key={logEntry.id}
                  className="log-line"
                  style={{ borderLeft: `3px solid ${color}` }}
                >
                  <div className="log-header">
                    <span className="log-icon-wrap" style={{ marginRight: '4px' }}>
                      {icon}
                    </span>
                    <span
                      className="log-badge"
                      style={{
                        backgroundColor: `${color}20`,
                        color,
                        border: `1px solid ${color}40`,
                      }}
                    >
                      {logEntry.type}
                    </span>
                    <span className="log-time">{formatLogTime(logEntry.timestamp)}</span>
                  </div>
                  <div className="log-body">
                    <p
                      className="log-message"
                      style={{ color: color === '#f43f5e' ? '#fca5a5' : '#e5e7eb' }}
                    >
                      {logEntry.message}
                    </p>

                    {logEntry.details && (
                      <pre className="log-details">{logEntry.details}</pre>
                    )}

                    {logEntry.image && (
                      <div className="log-image-wrap">
                        <img
                          src={`data:image/jpeg;base64,${logEntry.image}`}
                          alt="Scene capture thumbnail"
                          className="log-preview-img"
                          loading="lazy"
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* ── IndexedDB Archive View ──────────────────────────────────────── */
        <div className="history-list" aria-label="Archived incident records">
          {archivedIncidents.length === 0 ? (
            <div className="empty-logs">
              No archived incidents found in IndexedDB storage.
            </div>
          ) : (
            archivedIncidents.map(inc => (
              <div key={inc.id} className="history-item">
                <div className="history-header">
                  <div className="flex-align">
                    <Calendar className="w-4 h-4 text-emerald-400" />
                    <span className="history-title">{inc.id}</span>
                  </div>
                  <button
                    onClick={() => void handleDeleteHistory(inc.id)}
                    className="btn-delete"
                    title="Delete record permanently"
                    aria-label={`Delete incident ${inc.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <p className="history-date">
                  Archived: {new Date(inc.timestamp).toLocaleString()}
                </p>
                <div className="history-body mt-2">
                  <p className="history-summary">
                    {inc.logs.length} log entries recorded during this incident.
                  </p>
                  <details className="history-details mt-1">
                    <summary className="cursor-pointer text-indigo-400 text-sm hover:underline">
                      View full incident timeline ({inc.logs.length} entries)
                    </summary>
                    <div className="history-logs-sublist mt-2 border-left pl-2">
                      {inc.logs.map(l => (
                        <div key={l.id} className="text-xs text-gray-400 mb-1">
                          [{formatLogTime(l.timestamp)}]{' '}
                          <span className="font-bold text-gray-300">{l.type}</span>: {l.message}
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default IncidentTimeline;
