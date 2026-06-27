/**
 * @file src/components/MonitoringStatus.tsx
 * @description AI Agent Status Panel component.
 *
 * Displays the live status of the ResQ agent including:
 * - Multi-modal confidence score breakdown
 * - Last Gemini Vision assessment with injury likelihood and scoring
 * - Visual progress bar for emergency severity
 * - Post-incident surveillance feed
 * - End session button for POST_INCIDENT_MONITORING state
 *
 * Hidden when agentState is 'IDLE'.
 */

import React from 'react';
import { useAgentStore } from '../store/agentStore';
import { Eye, FileText, Activity, XOctagon, BarChart2 } from 'lucide-react';

/**
 * Determines the color associated with an injury likelihood level.
 *
 * @param level - The injuryLikelihood string from Gemini
 * @returns CSS color string for visual styling
 */
function injuryColor(level: string): string {
  switch (level) {
    case 'high':
      return '#f43f5e';
    case 'medium':
      return '#f59e0b';
    case 'low':
      return '#10b981';
    default:
      return '#94a3b8';
  }
}

/**
 * AI Agent Status Panel showing the active Gemini analysis result and
 * post-incident monitoring feed.
 *
 * @example
 * ```tsx
 * <MonitoringStatus />
 * ```
 */
export const MonitoringStatus: React.FC = () => {
  const {
    agentState,
    activeAnalysisResult,
    confidenceScore,
    postIncidentFeed,
    endIncident,
    setAgentState,
    addLog,
  } = useAgentStore();

  if (agentState === 'IDLE') return null;

  /**
   * Concludes the post-incident monitoring session and returns to active monitoring.
   */
  const handleEndSession = () => {
    addLog('INFO', '🟢 Demobilizing ResQ monitoring session. Returning to normal telemetry monitoring.');
    endIncident();
    setAgentState('MONITORING');
  };

  return (
    <div className="status-card" id="ai-agent-status-panel">
      <div className="status-card-header">
        <h2 className="section-title flex-align">
          <Eye className="w-5 h-5 text-indigo-400" />
          <span>AI Agent Status Panel</span>
        </h2>
        {agentState === 'MONITORING' && (
          <div className="pulse-indicator">
            <span className="pulse-dot" />
            <span className="pulse-text text-emerald-400">PULSING TELEMETRY</span>
          </div>
        )}
        {agentState === 'POST_INCIDENT_MONITORING' && (
          <div className="pulse-indicator">
            <span className="pulse-dot" style={{ backgroundColor: '#f59e0b' }} />
            <span className="pulse-text text-amber-500">SURVEILLANCE MODE ACTIVE</span>
          </div>
        )}
      </div>

      {!activeAnalysisResult ? (
        <div className="empty-status">
          <p>No active incidents or AI checks logged during this session.</p>
          <span className="text-xs text-gray-500">
            Telemetry is active. If impact is triggered, Gemini Vision analysis will report here.
          </span>
        </div>
      ) : (
        <div className="analysis-summary mt-2">
          {/* ── Confidence Fusion Score ──────────────────────────────────────── */}
          {confidenceScore && (
            <div
              style={{
                background: 'rgba(139, 92, 246, 0.08)',
                border: '1px solid rgba(139, 92, 246, 0.25)',
                borderRadius: '10px',
                padding: '10px 14px',
                marginBottom: '14px',
              }}
            >
              <div className="tile-header" style={{ marginBottom: '8px' }}>
                <BarChart2 className="w-4 h-4 text-violet-400" />
                <span style={{ color: '#c4b5fd', fontWeight: 600, fontSize: '0.82rem' }}>
                  Multi-Modal Confidence Fusion
                </span>
              </div>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <span style={{ color: '#e2e8f0', fontSize: '0.85rem' }}>
                  Final:{' '}
                  <strong style={{ color: confidenceScore.finalScore >= 7 ? '#f43f5e' : '#10b981' }}>
                    {confidenceScore.finalScore.toFixed(1)}/10
                  </strong>
                </span>
                <span style={{ color: '#64748b', fontSize: '0.78rem' }}>
                  Accel {confidenceScore.accelScore.toFixed(1)} × {confidenceScore.accelWeight} +
                  Vision {confidenceScore.visionScore.toFixed(1)} × {confidenceScore.visionWeight}
                </span>
              </div>
              {/* Confidence bar */}
              <div
                style={{
                  marginTop: '8px',
                  height: '6px',
                  background: '#1e1e24',
                  borderRadius: '3px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${(confidenceScore.finalScore / 10) * 100}%`,
                    height: '100%',
                    background:
                      confidenceScore.finalScore >= 7
                        ? 'linear-gradient(90deg, #f43f5e, #e11d48)'
                        : confidenceScore.finalScore >= 5
                        ? 'linear-gradient(90deg, #f59e0b, #d97706)'
                        : 'linear-gradient(90deg, #10b981, #059669)',
                    borderRadius: '3px',
                    transition: 'width 0.5s ease-out',
                  }}
                />
              </div>
            </div>
          )}

          {/* ── Vision Assessment Header ───────────────────────────────────── */}
          <div className="summary-title-row">
            <h3 className="summary-section-title">Last Vision Assessment</h3>
            <span
              className={`summary-score-badge ${
                activeAnalysisResult.emergencyScore >= 6 ? 'badge-high' : 'badge-low'
              }`}
            >
              Score: {activeAnalysisResult.emergencyScore}/10
            </span>
          </div>

          {/* Vision Score Progress Bar */}
          <div
            className="score-bar-container mt-2"
            style={{ background: '#1e1e24', height: '8px', borderRadius: '4px', overflow: 'hidden' }}
          >
            <div
              style={{
                width: `${(activeAnalysisResult.emergencyScore / 10) * 100}%`,
                background:
                  activeAnalysisResult.emergencyScore >= 6
                    ? 'linear-gradient(90deg, #f43f5e, #e11d48)'
                    : 'linear-gradient(90deg, #10b981, #059669)',
                height: '100%',
                borderRadius: '4px',
                transition: 'width 0.5s ease-out',
              }}
            />
          </div>

          {/* Assessment Grid */}
          <div className="summary-grid mt-3">
            <div className="summary-tile">
              <span className="summary-label">Person Status:</span>
              <span className="summary-val text-white">
                {activeAnalysisResult.personStatus.toUpperCase().replace(/_/g, ' ')}
              </span>
            </div>

            <div className="summary-tile">
              <span className="summary-label">Injury Likelihood:</span>
              <span
                className="summary-val"
                style={{ color: injuryColor(activeAnalysisResult.injuryLikelihood) }}
              >
                {activeAnalysisResult.injuryLikelihood.toUpperCase()}
              </span>
            </div>

            <div className="summary-tile">
              <span className="summary-label">AI Recommendation:</span>
              <span
                className="summary-val"
                style={{
                  color:
                    activeAnalysisResult.recommendation === 'EMERGENCY_CONFIRMED'
                      ? '#f43f5e'
                      : '#10b981',
                }}
              >
                {activeAnalysisResult.recommendation
                  ? activeAnalysisResult.recommendation.replace(/_/g, ' ')
                  : 'MONITOR'}
              </span>
            </div>

            {activeAnalysisResult.apparentDanger && (
              <div className="summary-tile">
                <span className="summary-label">Scene Danger:</span>
                <span className="summary-val text-white">
                  {activeAnalysisResult.apparentDanger.toUpperCase()}
                </span>
              </div>
            )}
          </div>

          {/* Visual Observations */}
          {activeAnalysisResult.visualObservations && (
            <div className="mt-3">
              <h4 className="tile-sublabel flex-align">
                <Eye className="w-3.5 h-3.5 text-sky-400" />
                Visual Observations
              </h4>
              <p className="summary-text-block" style={{ color: '#93c5fd' }}>
                {activeAnalysisResult.visualObservations}
              </p>
            </div>
          )}

          {/* Agent Reasoning */}
          <div className="mt-3">
            <h4 className="tile-sublabel flex-align">
              <FileText className="w-3.5 h-3.5 text-emerald-400" />
              Agent Logic Rationale
            </h4>
            <p className="summary-text-block">{activeAnalysisResult.reasoning}</p>
          </div>

          {/* Post-Incident Surveillance Feed */}
          {postIncidentFeed.length > 0 && (
            <div className="mt-4 border-top pt-3">
              <h4 className="tile-sublabel flex-align text-amber-500">
                <Activity className="w-4 h-4 text-amber-500 animate-pulse" />
                <span>Post-Incident Surveillance Feed (10s intervals)</span>
              </h4>
              <div
                className="monitoring-feed-list mt-2"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  maxHeight: '180px',
                  overflowY: 'auto',
                }}
              >
                {postIncidentFeed.map((item, index) => (
                  <div
                    key={index}
                    className="feed-item"
                    style={{
                      background: 'rgba(245, 158, 11, 0.05)',
                      borderLeft: '3px solid #f59e0b',
                      padding: '8px 12px',
                      borderRadius: '4px',
                      fontSize: '0.8rem',
                      color: '#e5e7eb',
                    }}
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* End Session Button */}
          {agentState === 'POST_INCIDENT_MONITORING' && (
            <div className="flex justify-end mt-4">
              <button
                id="btn-end-session"
                onClick={handleEndSession}
                className="btn btn-danger btn-flex"
                style={{ width: '100%', marginTop: '12px' }}
              >
                <XOctagon className="w-4 h-4" />
                <span>End Monitoring Session</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MonitoringStatus;
