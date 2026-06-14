import { useState } from 'react';

const STATUS_LABELS = {
  dispatched: 'Ambulance Dispatched',
  en_route:   'En Route to Hospital',
  arrived:    'Arrived at ER',
  closed:     'Incident Closed'
};

export default function FamilyTracker({ incidents, hospitals }) {
  const [selectedIncidentId, setSelectedIncidentId] = useState('');

  const activeIncident = selectedIncidentId
    ? incidents.find((i) => i.id === selectedIncidentId)
    : incidents[0];

  const targetHospital = activeIncident
    ? hospitals.find((h) => h.id === (activeIncident.final_hospital_id || activeIncident.recommended_hospital_id))
    : null;

  const steps = [
    { label: 'Emergency Logged',     status: 'completed' },
    { label: 'AI Recommendation',    status: activeIncident ? 'completed' : 'pending' },
    { label: 'Ambulance Dispatched', status: activeIncident && activeIncident.status !== 'dispatched' ? 'completed' : activeIncident ? 'current' : 'pending' },
    { label: 'En Route to ER',       status: activeIncident?.status === 'en_route' ? 'current' : activeIncident?.status === 'arrived' || activeIncident?.status === 'closed' ? 'completed' : 'pending' },
    { label: 'Arrived & Admitted',   status: activeIncident?.status === 'arrived' || activeIncident?.status === 'closed' ? 'completed' : 'pending' }
  ];

  const stepDescriptions = [
    'Emergency call processed at CATS Dispatch.',
    'Hospital match generated using live capacity feeds.',
    'Ambulance left base station.',
    'Driving under sirens to ER.',
    'Patient handed off to emergency care team.'
  ];

  return (
    <div className="familyTrackerContainer">
      <div className="trackerHeader">
        <h1>🚑 108 Ambulance Tracking Portal</h1>
        <p>Arjun's family proxy dashboard — real-time routing transparency.</p>

        {incidents.length > 1 && (
          <div className="incidentSelectRow">
            <label htmlFor="trackerIncidentSelect">Active case:</label>
            <select
              id="trackerIncidentSelect"
              value={selectedIncidentId || (activeIncident?.id ?? '')}
              onChange={(e) => setSelectedIncidentId(e.target.value)}
            >
              {incidents.map((i, idx) => (
                <option key={i.id} value={i.id}>
                  Case #{idx + 1} — {i.condition_type.toUpperCase()} ({i.caller_address?.split(',')[0]})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {!activeIncident ? (
        <div className="trackerEmptyState">
          <i className="trackerEmptyIcon">🚑</i>
          <h3>No active dispatches found</h3>
          <p>
            Please use the <strong>Dispatcher Console</strong> to submit an emergency call
            and find a hospital recommendation first.
          </p>
        </div>
      ) : (
        <div className="trackerMainCard">
          {/* Status Banner */}
          <div className={`trackerStatusStrip ${activeIncident.status}`}>
            <div>
              <span>Current Status</span>
              <strong>{STATUS_LABELS[activeIncident.status] || 'Unknown'}</strong>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span>Condition</span>
              <strong>{activeIncident.condition_type?.toUpperCase()}</strong>
            </div>
          </div>

          <div className="trackerSplitContent">
            {/* Stepper column */}
            <div className="stepperSection">
              <h3>Live Progression</h3>
              <div className="progressStepper">
                {steps.map((step, idx) => (
                  <div key={idx} className={`stepRow ${step.status}`}>
                    <div className="stepIndicator">
                      <div className="stepCircle">
                        {step.status === 'completed' ? '✓' : idx + 1}
                      </div>
                      {idx < steps.length - 1 && <div className="stepLine" />}
                    </div>
                    <div className="stepContent">
                      <h4>{step.label}</h4>
                      <p>{step.status !== 'pending' ? stepDescriptions[idx] : '—'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Metrics and reasoning column */}
            <div className="detailsSection">
              {/* ETA Metrics */}
              <div className="trackerMetricsRow">
                <div className="metricBox">
                  <span>Drive Time</span>
                  <strong>{activeIncident.estimated_eta_min || '--'} min</strong>
                </div>
                <div className="metricBox">
                  <span>Distance</span>
                  <strong>{activeIncident.distance_km || '--'} km</strong>
                </div>
                <div className="metricBox">
                  <span>ER Queue</span>
                  <strong>{targetHospital?.patients_in_queue ?? 0} waiting</strong>
                </div>
              </div>

              {/* Chosen Hospital Profile */}
              {targetHospital && (
                <div className="targetHospitalCard">
                  <div className="cardHeader">
                    <span>Emergency Destination</span>
                    <h2>{targetHospital.name}</h2>
                    <p>📍 {targetHospital.address}</p>
                  </div>

                  <div className="hospitalReasoningCard">
                    <h4>✦ Why this hospital was selected</h4>
                    <p className="geminiReasonText">
                      "{activeIncident.gemini_reasoning || 'Nearest available facility selected based on incident criteria.'}"
                    </p>
                    <div className="aiBadge">
                      <i>✦</i> Ranked by Gemini Advisor
                    </div>
                  </div>

                  <div className="facilityCapabilityLog">
                    <h4>Available facilities matching case:</h4>
                    <div className="pillContainer">
                      {activeIncident.condition_type === 'cardiac' && targetHospital.has_cath_lab && <span className="activePill">❤️ Cath Lab</span>}
                      {targetHospital.has_icu && <span className="activePill">🏥 ICU Beds</span>}
                      {targetHospital.has_ventilators && <span className="activePill">🫁 Ventilators</span>}
                      {targetHospital.has_blood_bank && <span className="activePill">🩸 Blood Bank</span>}
                      {targetHospital.blood_o_neg && <span className="activePill">🔴 O-Negative</span>}
                    </div>
                  </div>
                </div>
              )}

              {/* Safety banner */}
              <div className="trackerSafetyBanner">
                <p>⚠️ <strong>NearDead Routing Protocol:</strong> This route is dynamically optimized for <strong>Time-to-Treatment</strong>. It prioritizes hospitals with immediate capability and open beds, which may not always be the physically closest facility.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
