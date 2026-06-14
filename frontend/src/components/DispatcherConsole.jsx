import DispatchPanel from './DispatchPanel.jsx';
import Map from './Map.jsx';
import ComparePanel from './ComparePanel.jsx';
import HospitalDrawer from './HospitalDrawer.jsx';

const STATUS_COLOR = {
  dispatched: 'var(--blue)',
  en_route:   'var(--amber)',
  arrived:    'var(--green)',
  closed:     'var(--text-dim)'
};

export default function DispatcherConsole({
  dispatch,
  incidents,
  hospitals,
  routedHospitals,
  selectedHospital,
  setSelectedHospital,
  activeCase,
  setActiveCase,
  onConfirmed
}) {
  return (
    <div className="workspace">
      {/* Column 1: Call Intake Panel */}
      <DispatchPanel
        dispatch={dispatch}
        onConfirmed={onConfirmed}
        onCaseChange={setActiveCase}
      />

      {/* Column 2: Center Map & Comparison */}
      <section className="centerStack">
        <Map
          hospitals={routedHospitals}
          selectedHospital={selectedHospital}
          onSelectHospital={setSelectedHospital}
          recommendations={dispatch.result?.recommendations}
          callLocation={activeCase}
        />
        <ComparePanel
          recommendations={dispatch.result?.recommendations}
          hospitals={routedHospitals}
        />
      </section>

      {/* Column 3: Capacity Drawer & Active Incident Log */}
      <section className="rightRail dispatchRightRail">
        <HospitalDrawer hospital={selectedHospital} />

        <div className="activeIncidentsLog">
          <div className="sectionHeader">
            <span>🚑 Recent Dispatches</span>
            <strong style={{ fontSize: '12px', color: 'var(--teal)', background: 'var(--teal-dim)', padding: '2px 10px', borderRadius: '999px', border: '1px solid var(--teal-glow)' }}>
              {incidents.incidents.length} active
            </strong>
          </div>

          <div className="incidentsScrollList">
            {incidents.incidents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '32px', marginBottom: '10px' }}>📭</div>
                <p style={{ fontSize: '13px', margin: 0 }}>No incidents dispatched yet.</p>
              </div>
            ) : (
              incidents.incidents.map((incident) => {
                const targetHospital = hospitals.find((h) => h.id === incident.recommended_hospital_id);
                const statusColor = STATUS_COLOR[incident.status] || 'var(--text-dim)';
                return (
                  <div
                    key={incident.id}
                    className="incidentLogCard"
                    style={{ borderLeftColor: statusColor }}
                  >
                    <div className="incidentHeader">
                      <span className={`statusBadge ${incident.status}`}>
                        {incident.status.replace('_', ' ')}
                      </span>
                      <small>{new Date(incident.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
                    </div>
                    <strong>
                      {incident.condition_type.toUpperCase()} Case
                      {incident.is_critical && (
                        <span style={{ marginLeft: '6px', color: 'var(--red)', fontSize: '11px' }}>🔴 CRITICAL</span>
                      )}
                    </strong>
                    <p>{incident.caller_address?.split(',')[0]}</p>
                    <div className="incidentFooter">
                      <span>→ {targetHospital?.short_name || 'Victoria'}</span>
                      {incident.estimated_eta_min && (
                        <span>⏱ {incident.estimated_eta_min} min</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
