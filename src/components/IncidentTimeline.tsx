import React, { useEffect, useState } from 'react';
import { useAgentStore } from '../store/agentStore';
import { getAllIncidents, deleteIncident, IncidentRecord } from '../services/incidentLogger';
import { FileText, Calendar, Trash2 } from 'lucide-react';

export const IncidentTimeline: React.FC = () => {
  const { logs } = useAgentStore();
  const [archivedIncidents, setArchivedIncidents] = useState<IncidentRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');

  const loadHistory = async () => {
    const list = await getAllIncidents();
    setArchivedIncidents(list);
  };

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab, logs]);

  const handleDeleteHistory = async (id: string) => {
    if (confirm('Delete this incident history permanently?')) {
      await deleteIncident(id);
      loadHistory();
    }
  };

  const getLogDetails = (message: string, type: string) => {
    let icon = 'ℹ️';
    let color = '#38bdf8'; // Default sky blue

    if (message.includes('High-impact') || message.includes('⚡') || message.includes('🚨') || type === 'ALERT') {
      icon = '⚡';
      color = '#f43f5e'; // Rose red for emergency
    } else if (message.includes('Camera') || message.includes('🎥') || message.includes('📸')) {
      icon = '🎥';
      color = '#38bdf8'; // Sky blue for camera
    } else if (message.includes('Gemini') || message.includes('AI') || message.includes('🤖') || type === 'DECISION') {
      icon = '🤖';
      color = '#a5b4fc'; // Indigo for AI
    } else if (message.includes('dispatched') || message.includes('alert') || message.includes('SMS') || message.includes('📡') || type === 'ACTION') {
      icon = '📡';
      color = '#f59e0b'; // Amber for dispatch
    } else if (message.includes('safe') || message.includes('cancelled') || message.includes('🟢') || message.includes('✅')) {
      icon = '✅';
      color = '#10b981'; // Emerald green for safe/cancelled
    }

    return { icon, color };
  };

  const formatLogTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="timeline-card">
      <div className="tab-row">
        <button 
          onClick={() => setActiveTab('current')} 
          className={`tab-btn ${activeTab === 'current' ? 'tab-btn-active' : ''}`}
        >
          <FileText className="w-4 h-4" />
          <span>Active Session Logs ({logs.length})</span>
        </button>
        <button 
          onClick={() => setActiveTab('history')} 
          className={`tab-btn ${activeTab === 'history' ? 'tab-btn-active' : ''}`}
        >
          <Calendar className="w-4 h-4" />
          <span>IndexedDB Archive ({archivedIncidents.length})</span>
        </button>
      </div>

      {activeTab === 'current' ? (
        <div className="logs-scroller">
          {logs.length === 0 ? (
            <div className="empty-logs">Console is idle. Logs will populate here upon activity.</div>
          ) : (
            logs.map((log) => {
              const { icon, color } = getLogDetails(log.message, log.type);
              return (
                <div key={log.id} className="log-line" style={{ borderLeft: `3px solid ${color}` }}>
                  <div className="log-header">
                    <span className="log-icon-wrap" style={{ marginRight: '4px' }}>{icon}</span>
                    <span 
                      className="log-badge" 
                      style={{ 
                        backgroundColor: `${color}20`, 
                        color: color, 
                        border: `1px solid ${color}40` 
                      }}
                    >
                      {log.type}
                    </span>
                    <span className="log-time">{formatLogTime(log.timestamp)}</span>
                  </div>
                  <div className="log-body">
                    <p className="log-message" style={{ color: color === '#f43f5e' ? '#fca5a5' : '#e5e7eb' }}>
                      {log.message}
                    </p>
                    
                    {log.details && (
                      <pre className="log-details">{log.details}</pre>
                    )}

                    {log.image && (
                      <div className="log-image-wrap">
                        <img 
                          src={`data:image/jpeg;base64,${log.image}`} 
                          alt="Scene capture" 
                          className="log-preview-img"
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
        <div className="history-list">
          {archivedIncidents.length === 0 ? (
            <div className="empty-logs">No archived incidents found in IndexedDB storage.</div>
          ) : (
            archivedIncidents.map((inc) => (
              <div key={inc.id} className="history-item">
                <div className="history-header">
                  <div className="flex-align">
                    <Calendar className="w-4 h-4 text-emerald-400" />
                    <span className="history-title">{inc.id}</span>
                  </div>
                  <button 
                    onClick={() => handleDeleteHistory(inc.id)}
                    className="btn-delete"
                    title="Delete record"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <p className="history-date">
                  Archived on: {new Date(inc.timestamp).toLocaleString()}
                </p>
                <div className="history-body mt-2">
                  <p className="history-summary">
                    Events Logged: {inc.logs.length} entries.
                  </p>
                  <details className="history-details mt-1">
                    <summary className="cursor-pointer text-indigo-400 text-sm hover:underline">
                      View full incident timeline
                    </summary>
                    <div className="history-logs-sublist mt-2 border-left pl-2">
                      {inc.logs.map((l) => (
                        <div key={l.id} className="text-xs text-gray-400 mb-1">
                          [{formatLogTime(l.timestamp)}] <span className="font-bold text-gray-300">{l.type}</span>: {l.message}
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
