import { STATUS_LABEL } from '../lib/constants.js';

export default function HospitalDrawer({ hospital }) {
  if (!hospital) {
    return (
      <aside className="hospitalDrawer">
        <span>Hospital detail</span>
        <p>Select a hospital pin to inspect capacity.</p>
      </aside>
    );
  }

  return (
    <aside className="hospitalDrawer">
      <span>{hospital.zone}</span>
      <h2>{hospital.name}</h2>
      <div className="drawerGrid">
        <div>
          <strong>{hospital.available_er_beds ?? 0}</strong>
          <span>ER beds</span>
        </div>
        <div>
          <strong>{hospital.available_icu_beds ?? 0}</strong>
          <span>ICU beds</span>
        </div>
        <div>
          <strong>{hospital.available_ventilators ?? 0}</strong>
          <span>Ventilators</span>
        </div>
        <div>
          <strong>{hospital.wait_time_minutes ?? 0}m</strong>
          <span>Wait</span>
        </div>
      </div>
      <div className="loadMeter">
        <span style={{ width: `${hospital.load_percentage || 0}%` }} />
      </div>
      <p>
        {STATUS_LABEL[hospital.er_status] || hospital.er_status} at {Math.round(hospital.load_percentage || 0)}% load.
      </p>
      <div className="capabilityList">
        {hospital.has_cath_lab && <span>Cath lab</span>}
        {hospital.has_icu && <span>ICU</span>}
        {hospital.has_trauma_center && <span>Trauma</span>}
        {hospital.has_blood_bank && <span>Blood bank</span>}
        {hospital.has_nicu && <span>NICU</span>}
      </div>
    </aside>
  );
}

