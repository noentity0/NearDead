-- ════════════════════════════════════════════════════════════════
-- NearDead — Supabase Setup SQL
-- Run this in Supabase SQL Editor BEFORE running seed_neardead.py
-- ════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────
-- 1. HOSPITALS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hospitals (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL UNIQUE,
  short_name        TEXT,
  address           TEXT,
  lat               DECIMAL(9,6) NOT NULL,
  lng               DECIMAL(9,6) NOT NULL,
  zone              TEXT,
  tier              INTEGER,

  has_trauma_center BOOLEAN DEFAULT false,
  has_icu           BOOLEAN DEFAULT false,
  has_ventilators   BOOLEAN DEFAULT false,
  has_blood_bank    BOOLEAN DEFAULT false,
  has_cath_lab      BOOLEAN DEFAULT false,
  has_burn_unit     BOOLEAN DEFAULT false,
  has_nicu          BOOLEAN DEFAULT false,
  specialties       TEXT[],

  total_er_beds     INTEGER,
  total_icu_beds    INTEGER,
  total_ventilators INTEGER,

  admin_email       TEXT,
  last_verified_at  TIMESTAMPTZ,
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────
-- 2. CAPACITY SNAPSHOTS (append-only)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS capacity_snapshots (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id           UUID REFERENCES hospitals(id) ON DELETE CASCADE,
  recorded_at           TIMESTAMPTZ DEFAULT NOW(),
  recorded_by           TEXT DEFAULT 'system',

  available_er_beds     INTEGER NOT NULL,
  available_icu_beds    INTEGER,
  available_ventilators INTEGER,
  doctors_on_duty       INTEGER,
  nurses_on_duty        INTEGER,

  er_status             TEXT CHECK (er_status IN ('open','caution','overwhelmed','closed')),
  wait_time_minutes     INTEGER,
  patients_in_queue     INTEGER,

  blood_a_pos           BOOLEAN,
  blood_b_pos           BOOLEAN,
  blood_o_pos           BOOLEAN,
  blood_ab_pos          BOOLEAN,
  blood_o_neg           BOOLEAN,

  load_percentage       DECIMAL(5,2),
  intake_rate_per_hour  INTEGER,
  is_simulated          BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_snapshots_hospital_time
  ON capacity_snapshots(hospital_id, recorded_at DESC);

-- ──────────────────────────────────────────────────────────────
-- 3. ACTIVE INCIDENTS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS active_incidents (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW(),

  caller_phone             TEXT,
  caller_lat               DECIMAL(9,6),
  caller_lng               DECIMAL(9,6),
  caller_address           TEXT,

  patient_age              INTEGER,
  patient_gender           TEXT,
  condition_type           TEXT CHECK (condition_type IN (
                             'cardiac','trauma','stroke','respiratory',
                             'pediatric','burn','obstetric','other'
                           )),
  condition_notes          TEXT,
  blood_type_needed        TEXT,
  is_critical              BOOLEAN DEFAULT false,

  recommended_hospital_id  UUID REFERENCES hospitals(id),
  gemini_reasoning         TEXT,
  gemini_confidence        DECIMAL(4,2),
  dispatcher_override      BOOLEAN DEFAULT false,
  final_hospital_id        UUID REFERENCES hospitals(id),

  route_polyline           TEXT,
  estimated_eta_min        INTEGER,
  distance_km              DECIMAL(6,2),

  status                   TEXT CHECK (status IN (
                             'dispatched','en_route','arrived',
                             'transferred','closed'
                           )) DEFAULT 'dispatched',
  actual_arrival_at        TIMESTAMPTZ,
  outcome_notes            TEXT,
  dispatcher_id            TEXT
);

-- ──────────────────────────────────────────────────────────────
-- 4. ROUTE DECISIONS (all 3 ranked options stored)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS route_decisions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id       UUID REFERENCES active_incidents(id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),

  rank              INTEGER CHECK (rank IN (1,2,3)),
  hospital_id       UUID REFERENCES hospitals(id),

  available_beds    INTEGER,
  doctors_on_duty   INTEGER,
  er_status         TEXT,
  wait_time_min     INTEGER,

  distance_km       DECIMAL(6,2),
  eta_minutes       INTEGER,

  confidence_score  DECIMAL(4,2),
  reasoning         TEXT,
  disqualified      BOOLEAN DEFAULT false,
  disqualify_reason TEXT
);

-- ──────────────────────────────────────────────────────────────
-- 5. PREDICTION ALERTS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prediction_alerts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  hospital_id     UUID REFERENCES hospitals(id),

  alert_type      TEXT CHECK (alert_type IN (
                    'capacity_warning',
                    'capacity_critical',
                    'surge_predicted',
                    'staff_shortage'
                  )),
  predicted_at    TIMESTAMPTZ,
  confidence      DECIMAL(4,2),
  message         TEXT,
  minutes_until   INTEGER,

  acknowledged    BOOLEAN DEFAULT false,
  acknowledged_by TEXT,
  acknowledged_at TIMESTAMPTZ,
  was_accurate    BOOLEAN
);

-- ──────────────────────────────────────────────────────────────
-- 6. RPC: get_hospital_current_status
--    Returns each hospital joined with its LATEST snapshot.
--    Called by the dispatcher dashboard map on load.
--    Called by seed_neardead.py --status
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_hospital_current_status()
RETURNS TABLE (
  id                    UUID,
  name                  TEXT,
  short_name            TEXT,
  lat                   DECIMAL,
  lng                   DECIMAL,
  zone                  TEXT,
  tier                  INTEGER,
  has_trauma_center     BOOLEAN,
  has_icu               BOOLEAN,
  has_ventilators       BOOLEAN,
  has_blood_bank        BOOLEAN,
  has_cath_lab          BOOLEAN,
  has_burn_unit         BOOLEAN,
  has_nicu              BOOLEAN,
  specialties           TEXT[],
  total_er_beds         INTEGER,
  -- Latest snapshot fields
  available_er_beds     INTEGER,
  available_icu_beds    INTEGER,
  available_ventilators INTEGER,
  doctors_on_duty       INTEGER,
  er_status             TEXT,
  wait_time_minutes     INTEGER,
  patients_in_queue     INTEGER,
  load_percentage       DECIMAL,
  intake_rate_per_hour  INTEGER,
  blood_o_neg           BOOLEAN,
  snapshot_age_seconds  INTEGER
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    h.id,
    h.name,
    h.short_name,
    h.lat,
    h.lng,
    h.zone,
    h.tier,
    h.has_trauma_center,
    h.has_icu,
    h.has_ventilators,
    h.has_blood_bank,
    h.has_cath_lab,
    h.has_burn_unit,
    h.has_nicu,
    h.specialties,
    h.total_er_beds,
    -- Latest snapshot (DISTINCT ON = one row per hospital, most recent)
    cs.available_er_beds,
    cs.available_icu_beds,
    cs.available_ventilators,
    cs.doctors_on_duty,
    cs.er_status,
    cs.wait_time_minutes,
    cs.patients_in_queue,
    cs.load_percentage,
    cs.intake_rate_per_hour,
    cs.blood_o_neg,
    EXTRACT(EPOCH FROM (NOW() - cs.recorded_at))::INTEGER AS snapshot_age_seconds
  FROM hospitals h
  LEFT JOIN LATERAL (
    SELECT *
    FROM capacity_snapshots
    WHERE hospital_id = h.id
    ORDER BY recorded_at DESC
    LIMIT 1
  ) cs ON true
  WHERE h.is_active = true
  ORDER BY h.zone, h.name;
$$;

-- ──────────────────────────────────────────────────────────────
-- 7. RPC: get_hospital_load_history
--    Returns last N hours of snapshots for a hospital.
--    Used by prediction model + sparkline charts.
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_hospital_load_history(
  p_hospital_id UUID,
  p_hours       INTEGER DEFAULT 3
)
RETURNS TABLE (
  recorded_at          TIMESTAMPTZ,
  load_percentage      DECIMAL,
  available_er_beds    INTEGER,
  er_status            TEXT,
  wait_time_minutes    INTEGER,
  intake_rate_per_hour INTEGER
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    recorded_at,
    load_percentage,
    available_er_beds,
    er_status,
    wait_time_minutes,
    intake_rate_per_hour
  FROM capacity_snapshots
  WHERE
    hospital_id = p_hospital_id
    AND recorded_at >= NOW() - (p_hours || ' hours')::INTERVAL
  ORDER BY recorded_at ASC;
$$;

-- ──────────────────────────────────────────────────────────────
-- 8. REALTIME — enable for all key tables
-- ──────────────────────────────────────────────────────────────
-- Run these in Supabase dashboard → Database → Replication
-- or via this SQL:

ALTER PUBLICATION supabase_realtime ADD TABLE capacity_snapshots;
ALTER PUBLICATION supabase_realtime ADD TABLE prediction_alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE active_incidents;

-- ──────────────────────────────────────────────────────────────
-- 9. ROW LEVEL SECURITY (basic — tighten post-hackathon)
-- ──────────────────────────────────────────────────────────────
ALTER TABLE hospitals          ENABLE ROW LEVEL SECURITY;
ALTER TABLE capacity_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_incidents   ENABLE ROW LEVEL SECURITY;
ALTER TABLE prediction_alerts  ENABLE ROW LEVEL SECURITY;

-- Allow public read on hospitals and capacity (dashboard needs this)
CREATE POLICY "Public read hospitals"
  ON hospitals FOR SELECT USING (true);

CREATE POLICY "Public read capacity"
  ON capacity_snapshots FOR SELECT USING (true);

CREATE POLICY "Public read alerts"
  ON prediction_alerts FOR SELECT USING (true);

-- Insert requires service role key (used by seed script + backend API)
-- The anon key used by the dashboard can only read.
-- Your FastAPI backend uses the service role key.

-- ──────────────────────────────────────────────────────────────
-- 10. DEMO HELPER VIEW: side-by-side comparison data
--     Used by the "Old System vs NearDead" panel
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW demo_comparison AS
SELECT
  ai.id                                AS incident_id,
  ai.condition_type,
  ai.created_at,

  -- Nearest hospital (old system = closest regardless of capacity)
  nearest.name                         AS old_system_hospital,
  nearest_rd.distance_km               AS old_system_distance_km,
  nearest_rd.eta_minutes               AS old_system_eta_min,
  nearest_rd.er_status                 AS old_system_er_status,
  nearest_rd.wait_time_min             AS old_system_wait_min,

  -- Recommended hospital (NearDead)
  rec.name                             AS neardead_hospital,
  rec_rd.distance_km                   AS neardead_distance_km,
  rec_rd.eta_minutes                   AS neardead_eta_min,
  rec_rd.er_status                     AS neardead_er_status,
  rec_rd.wait_time_min                 AS neardead_wait_min,

  -- Time difference (the number that wins the demo)
  (nearest_rd.wait_time_min + nearest_rd.eta_minutes)
    - (rec_rd.wait_time_min + rec_rd.eta_minutes)   AS minutes_saved

FROM active_incidents ai
-- NearDead recommendation (rank 1)
JOIN route_decisions rec_rd
  ON rec_rd.incident_id = ai.id AND rec_rd.rank = 1
JOIN hospitals rec
  ON rec.id = rec_rd.hospital_id
-- "Old system" = nearest hospital regardless of capacity (rank by distance ASC)
JOIN LATERAL (
  SELECT * FROM route_decisions
  WHERE incident_id = ai.id
  ORDER BY distance_km ASC
  LIMIT 1
) nearest_rd ON true
JOIN hospitals nearest
  ON nearest.id = nearest_rd.hospital_id

ORDER BY ai.created_at DESC;
