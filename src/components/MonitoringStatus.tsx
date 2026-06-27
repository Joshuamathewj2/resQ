import React from 'react';
import { useAgentStore } from '../store/agentStore';
import { Eye, FileText, Activity, XOctagon } from 'lucide-react';

export const MonitoringStatus: React.FC = () => {
  const { 
    agentState, 
    activeAnalysisResult, 
    postIncidentFeed, 
    endIncident, 
    setAgentState,
    addLog 
  } = useAgentStore();

  if (agentState === 'IDLE') return null;

  const handleEndSession = () => {
    addLog('INFO', '🟢 Demobilizing ResQ monitoring session. Returning to normal telemetry monitoring.');
    endIncident();
    setAgentState('MONITORING');
  };

  return (
    <div className="status-card">
      <div className="status-card-header">
        <h2 className="section-title flex-align">
          <Eye className="w-5 h-5 text-indigo-400" />
          <span>AI Agent Status Panel</span>
        </h2>
        {agentState === 'MONITORING' && (
          <div className="pulse-indicator">
            <span className="pulse-dot"></span>
            <span className="pulse-text text-emerald-400">PULSING TELEMETRY</span>
          </div>
        )}
        {agentState === 'POST_INCIDENT_MONITORING' && (
          <div className="pulse-indicator">
            <span className="pulse-dot" style={{ backgroundColor: '#f59e0b' }}></span>
            <span className="pulse-text text-amber-500">SURVEILLANCE MODE ACTIVE</span>
          </div>
        )}
      </div>

      {!activeAnalysisResult ? (
        <div className="empty-status">
          <p>No active incidents or AI checks logged during this session.</p>
          <span className="text-xs text-gray-500">Telemetry is active. If impact is triggered, Gemini Vision analysis will report details here.</span>
        </div>
      ) : (
        <div className="analysis-summary mt-2">
          <div className="summary-title-row">
            <h3 className="summary-section-title">Last Vision Assessment</h3>
            <span className={`summary-score-badge ${activeAnalysisResult.emergencyScore >= 6 ? 'badge-high' : 'badge-low'}`}>
              Score: {activeAnalysisResult.emergencyScore}/10
            </span>
          </div>

          {/* Visual Score Progress Bar */}
          <div className="score-bar-container mt-2" style={{ background: '#1e1e24', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
            <div 
              style={{ 
                width: `${(activeAnalysisResult.emergencyScore / 10) * 100}%`, 
                background: activeAnalysisResult.emergencyScore >= 6 ? 'linear-gradient(90deg, #f43f5e, #e11d48)' : 'linear-gradient(90deg, #10b981, #059669)',
                height: '100%',
                borderRadius: '4px',
                transition: 'width 0.5s ease-out'
              }} 
            />
          </div>
          
          <div className="summary-grid mt-3">
            <div className="summary-tile">
              <span className="summary-label">Person Status:</span>
              <span className="summary-val text-white">{activeAnalysisResult.personStatus.toUpperCase().replace('_', ' ')}</span>
            </div>
            
            <div className="summary-tile">
              <span className="summary-label">Injury Likelihood:</span>
              <span className="summary-val text-white">{activeAnalysisResult.injuryLikelihood.toUpperCase()}</span>
            </div>

            <div className="summary-tile">
              <span className="summary-label">Recommendation:</span>
              <span 
                className="summary-val" 
                style={{ color: activeAnalysisResult.recommendation === 'EMERGENCY_CONFIRMED' ? '#f43f5e' : '#10b981' }}
              >
                {activeAnalysisResult.recommendation ? activeAnalysisResult.recommendation.replace('_', ' ') : 'MONITOR'}
              </span>
            </div>
          </div>

          <div className="mt-3">
            <h4 className="tile-sublabel flex-align">
              <FileText className="w-3.5 h-3.5 text-emerald-400" />
              Agent Logic Rationale
            </h4>
            <p className="summary-text-block">{activeAnalysisResult.reasoning}</p>
          </div>

          {/* Step 6: Post Incident Monitoring Live Feed */}
          {postIncidentFeed.length > 0 && (
            <div className="mt-4 border-top pt-3">
              <h4 className="tile-sublabel flex-align text-amber-500">
                <Activity className="w-4 h-4 text-amber-500 animate-pulse" />
                <span>Post-Incident Surveillance Feed (10s intervals)</span>
              </h4>
              <div className="monitoring-feed-list mt-2" style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                {postIncidentFeed.map((item, index) => (
                  <div key={index} className="feed-item" style={{ background: 'rgba(245, 158, 11, 0.05)', borderLeft: '3px solid #f59e0b', padding: '8px 12px', borderRadius: '4px', fontSize: '0.8rem', color: '#e5e7eb' }}>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* End Monitoring Session Button */}
          {agentState === 'POST_INCIDENT_MONITORING' && (
            <div className="flex justify-end mt-4">
              <button onClick={handleEndSession} className="btn btn-danger btn-flex" style={{ width: '100%', marginTop: '12px' }}>
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
