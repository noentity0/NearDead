import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

export default function AdminForm({ hospitals, onUpdated }) {
  const [hospitalId, setHospitalId] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');

  // Form states
  const [erBeds, setErBeds] = useState(10);
  const [icuBeds, setIcuBeds] = useState(5);
  const [ventilators, setVentilators] = useState(3);
  const [doctors, setDoctors] = useState(4);
  const [nurses, setNurses] = useState(12);
  const [erStatus, setErStatus] = useState('open');
  const [waitTime, setWaitTime] = useState(15);
  const [queueSize, setQueueSize] = useState(5);
  
  // Toggles for capabilities (some hospitals can change capabilities dynamic or static)
  const [hasIcu, setHasIcu] = useState(true);
  const [hasTrauma, setHasTrauma] = useState(true);
  const [hasCathLab, setHasCathLab] = useState(true);
  const [hasBloodBank, setHasBloodBank] = useState(true);
  const [bloodONeg, setBloodONeg] = useState(true);

  useEffect(() => {
    if (!hospitalId && hospitals[0]) {
      setHospitalId(hospitals[0].id);
    }
  }, [hospitalId, hospitals]);

  // Load selected hospital details into form state
  useEffect(() => {
    const selected = hospitals.find((h) => h.id === hospitalId);
    if (selected) {
      setErBeds(selected.available_er_beds ?? 10);
      setIcuBeds(selected.available_icu_beds ?? 5);
      setVentilators(selected.available_ventilators ?? 3);
      setDoctors(selected.doctors_on_duty ?? 4);
      setNurses(selected.nurses_on_duty ?? 12);
      setErStatus(selected.er_status ?? 'open');
      setWaitTime(selected.wait_time_minutes ?? 15);
      setQueueSize(selected.patients_in_queue ?? 5);
      
      setHasIcu(selected.has_icu ?? true);
      setHasTrauma(selected.has_trauma_center ?? true);
      setHasCathLab(selected.has_cath_lab ?? true);
      setHasBloodBank(selected.has_blood_bank ?? true);
      setBloodONeg(selected.blood_o_neg ?? true);
    }
  }, [hospitalId, hospitals]);

  const selectedHospital = hospitals.find((h) => h.id === hospitalId);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!selectedHospital) return;
    setSaving(true);
    setSuccess('');

    // Compute load percentage: (total - available) / total * 100
    const totalBeds = selectedHospital.total_er_beds || 30;
    const occupied = Math.max(0, totalBeds - erBeds);
    const loadPercentage = Math.round((occupied / totalBeds) * 100);

    try {
      await api.updateCapacity(selectedHospital.id, {
        available_er_beds: Number(erBeds),
        available_icu_beds: Number(icuBeds),
        available_ventilators: Number(ventilators),
        doctors_on_duty: Number(doctors),
        nurses_on_duty: Number(nurses),
        er_status: erStatus,
        wait_time_minutes: Number(waitTime),
        patients_in_queue: Number(queueSize),
        load_percentage: loadPercentage,
        has_icu: hasIcu,
        has_trauma_center: hasTrauma,
        has_cath_lab: hasCathLab,
        has_blood_bank: hasBloodBank,
        blood_o_neg: bloodONeg
      });
      setSuccess(`Capacity update published for ${selectedHospital.short_name}!`);
      await onUpdated?.();
      
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="adminPortalContainer">
      <div className="portalHeader">
        <h1>ER capacity reporting portal</h1>
        <p>Dr. Meena's station dashboard — update capacity in under 30 seconds.</p>
      </div>

      <div className="portalLayout">
        {/* Left Side: Live Form */}
        <form onSubmit={handleSubmit} className="portalFormCard">
          <div className="formHeader">
            <h2>Report live numbers</h2>
            <div className="selectHospitalWrapper">
              <label htmlFor="hospitalSelect">Managing hospital:</label>
              <select
                id="hospitalSelect"
                value={hospitalId}
                onChange={(e) => setHospitalId(e.target.value)}
              >
                {hospitals.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {success && <div className="portalSuccessMessage">{success}</div>}

          {/* 3-State ER Status */}
          <div className="statusSection">
            <span className="sectionSubhead">ER operational status</span>
            <div className="statusButtonGroup">
              <button
                type="button"
                className={`statusSelectBtn open ${erStatus === 'open' ? 'active' : ''}`}
                onClick={() => setErStatus('open')}
              >
                <i className="statusIndicatorDot green" />
                <span>Open / Normal</span>
              </button>
              <button
                type="button"
                className={`statusSelectBtn caution ${erStatus === 'caution' ? 'active' : ''}`}
                onClick={() => setErStatus('caution')}
              >
                <i className="statusIndicatorDot yellow" />
                <span>Caution / Load</span>
              </button>
              <button
                type="button"
                className={`statusSelectBtn overwhelmed ${erStatus === 'overwhelmed' ? 'active' : ''}`}
                onClick={() => setErStatus('overwhelmed')}
              >
                <i className="statusIndicatorDot red" />
                <span>Overwhelmed</span>
              </button>
            </div>
          </div>

          <div className="slidersGrid">
            {/* Slider 1: ER Beds */}
            <div className="formControl">
              <div className="controlLabelHeader">
                <label>Available ER beds</label>
                <span className="controlValueBadge">{erBeds} / {selectedHospital?.total_er_beds || 30}</span>
              </div>
              <input
                type="range"
                min="0"
                max={selectedHospital?.total_er_beds || 40}
                value={erBeds}
                onChange={(e) => setErBeds(Number(e.target.value))}
                className="portalSlider"
              />
            </div>

            {/* Slider 2: ICU Beds */}
            <div className="formControl">
              <div className="controlLabelHeader">
                <label>Available ICU beds</label>
                <span className="controlValueBadge">{icuBeds} / {selectedHospital?.total_icu_beds || 15}</span>
              </div>
              <input
                type="range"
                min="0"
                max={selectedHospital?.total_icu_beds || 20}
                value={icuBeds}
                onChange={(e) => setIcuBeds(Number(e.target.value))}
                className="portalSlider"
              />
            </div>

            {/* Slider 3: Ventilators */}
            <div className="formControl">
              <div className="controlLabelHeader">
                <label>Available ventilators</label>
                <span className="controlValueBadge">{ventilators} / {selectedHospital?.total_ventilators || 10}</span>
              </div>
              <input
                type="range"
                min="0"
                max={selectedHospital?.total_ventilators || 15}
                value={ventilators}
                onChange={(e) => setVentilators(Number(e.target.value))}
                className="portalSlider"
              />
            </div>

            {/* Slider 4: Wait Time */}
            <div className="formControl">
              <div className="controlLabelHeader">
                <label>Avg ER wait time (minutes)</label>
                <span className="controlValueBadge highlight">{waitTime} min</span>
              </div>
              <input
                type="range"
                min="5"
                max="240"
                step="5"
                value={waitTime}
                onChange={(e) => setWaitTime(Number(e.target.value))}
                className="portalSlider timeSlider"
              />
            </div>
          </div>

          <div className="numericInputsRow">
            <div className="formControl">
              <label>Doctors on duty</label>
              <input
                type="number"
                min="0"
                max="30"
                value={doctors}
                onChange={(e) => setDoctors(Number(e.target.value))}
              />
            </div>
            <div className="formControl">
              <label>Nurses on duty</label>
              <input
                type="number"
                min="0"
                max="100"
                value={nurses}
                onChange={(e) => setNurses(Number(e.target.value))}
              />
            </div>
            <div className="formControl">
              <label>Patients in queue</label>
              <input
                type="number"
                min="0"
                max="200"
                value={queueSize}
                onChange={(e) => setQueueSize(Number(e.target.value))}
              />
            </div>
          </div>

          {/* Capabilities Checklist */}
          <div className="portalCapabilitiesCard">
            <h3>⚕️ Specialist facilities &amp; capabilities</h3>
            <div className="capabilitiesTogglesGrid">
              {[
                { id: 'toggle-icu',       label: '🏥 ICU Unit Online',        checked: hasIcu,       setter: setHasIcu },
                { id: 'toggle-trauma',    label: '🚑 Trauma Center Online',   checked: hasTrauma,    setter: setHasTrauma },
                { id: 'toggle-cathlab',   label: '❤️ Cath Lab Online',        checked: hasCathLab,   setter: setHasCathLab },
                { id: 'toggle-bloodbank', label: '🩸 Blood Bank Operating',   checked: hasBloodBank, setter: setHasBloodBank },
                { id: 'toggle-oneg',      label: '🔴 O-Neg Blood Available',  checked: bloodONeg,    setter: setBloodONeg },
              ].map(({ id, label, checked, setter }) => (
                <label key={id} className="toggleSwitchLabel" style={{ borderColor: checked ? 'rgba(0,212,232,0.35)' : undefined, color: checked ? 'var(--teal)' : undefined }}>
                  <input
                    id={id}
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => setter(e.target.checked)}
                  />
                  <div className="toggle-track" style={{ background: checked ? 'var(--teal)' : undefined, borderColor: checked ? 'var(--teal)' : undefined }}>
                    <div className="toggle-thumb" style={{ transform: checked ? 'translateX(12px)' : undefined, background: checked ? '#001a1e' : undefined }} />
                  </div>
                  <span style={{ fontSize: '12px' }}>{label}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            id="btn-publish-capacity"
            type="submit"
            className="portalPublishBtn"
            disabled={saving || !selectedHospital}
          >
            {saving ? '⏳ Publishing updates...' : '📡 Publish Capacity Update'}
          </button>
        </form>

        {/* Right Side: Quick Stats Display */}
        <div className="portalStatusCard">
          <h2>Current published status</h2>
          {selectedHospital ? (
            <div className="publishedSummary">
              <div className="summaryHospitalName">
                <h3>{selectedHospital.name}</h3>
                <span className={`statusPill ${selectedHospital.er_status}`}>
                  {selectedHospital.er_status?.toUpperCase()}
                </span>
              </div>
              
              <div className="summaryDetailsGrid">
                <div className="summaryDetailCell">
                  <span>ER Bed Load</span>
                  <strong>
                    {Math.round(selectedHospital.load_percentage ?? 50)}%
                  </strong>
                </div>
                <div className="summaryDetailCell">
                  <span>Free ER Beds</span>
                  <strong>{selectedHospital.available_er_beds ?? 0}</strong>
                </div>
                <div className="summaryDetailCell">
                  <span>Free ICU Beds</span>
                  <strong>{selectedHospital.available_icu_beds ?? 0}</strong>
                </div>
                <div className="summaryDetailCell">
                  <span>Free Ventilators</span>
                  <strong>{selectedHospital.available_ventilators ?? 0}</strong>
                </div>
                <div className="summaryDetailCell">
                  <span>Wait Time</span>
                  <strong>{selectedHospital.wait_time_minutes ?? 0}m</strong>
                </div>
                <div className="summaryDetailCell">
                  <span>Staffing</span>
                  <strong>{selectedHospital.doctors_on_duty ?? 0} Doc / {selectedHospital.nurses_on_duty ?? 0} Nurse</strong>
                </div>
              </div>
              
              <div className="capabilitiesList">
                <h4>Active Capabilities:</h4>
                <div className="pillContainer">
                  {selectedHospital.has_trauma_center && <span className="activePill">Trauma</span>}
                  {selectedHospital.has_icu && <span className="activePill">ICU</span>}
                  {selectedHospital.has_cath_lab && <span className="activePill">Cath Lab</span>}
                  {selectedHospital.has_blood_bank && <span className="activePill">Blood Bank</span>}
                  {selectedHospital.blood_o_neg && <span className="activePill">O-Negative</span>}
                </div>
              </div>

              <div className="portalStationLogs">
                <h4>Reporting Guidelines</h4>
                <p>1. Toggle <strong>Overwhelmed</strong> to stop non-critical ambulance arrivals via routing recommendations.</p>
                <p>2. Keep bed availability accurate. Dispatches check live beds first.</p>
                <p>3. Update wait time if surge conditions develop inside the ER triage.</p>
              </div>
            </div>
          ) : (
            <p className="noDataText">Select a hospital to see currently published metrics.</p>
          )}
        </div>
      </div>
    </div>
  );
}
