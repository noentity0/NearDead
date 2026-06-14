import { useEffect, useMemo, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const EMPTY_COLLECTION = { type: 'FeatureCollection', features: [] };

function callLngLat(callLocation) {
  return [
    Number(callLocation?.caller_lng || 77.6011),
    Number(callLocation?.caller_lat || 12.9757)
  ];
}

function hospitalLngLat(hospital) {
  return [Number(hospital.lng), Number(hospital.lat)];
}

function straightRoute(from, to) {
  if (!from || !to) return EMPTY_COLLECTION;
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [from, to] },
        properties: {}
      }
    ]
  };
}

function hospitalFeatures(hospitals, selectedHospital, recommendedId, nearestId) {
  return {
    type: 'FeatureCollection',
    features: hospitals.map((hospital) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: hospitalLngLat(hospital) },
      properties: {
        id: hospital.id,
        name: hospital.name,
        shortName: hospital.short_name || hospital.name,
        status: hospital.er_status || 'closed',
        recommended: hospital.id === recommendedId,
        nearest: hospital.id === nearestId,
        selected: hospital.id === selectedHospital?.id,
        eta: hospital.eta_minutes || 0,
        wait: hospital.wait_time_minutes || 0
      }
    }))
  };
}

function callerFeature(callLocation) {
  const label = (callLocation?.caller_address || 'MG Road, Bengaluru').split(',')[0];
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: callLngLat(callLocation) },
        properties: { label }
      }
    ]
  };
}

async function fetchDirections(from, to, signal) {
  if (!MAPBOX_TOKEN || !from || !to) return straightRoute(from, to);
  const params = new URLSearchParams({
    alternatives: 'false',
    geometries: 'geojson',
    overview: 'full',
    access_token: MAPBOX_TOKEN
  });
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${from[0]},${from[1]};${to[0]},${to[1]}?${params}`;
  try {
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`Mapbox route failed: ${response.status}`);
    const payload = await response.json();
    const geometry = payload.routes?.[0]?.geometry;
    if (!geometry) return straightRoute(from, to);
    return {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', geometry, properties: {} }]
    };
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    return straightRoute(from, to);
  }
}

function ensureSource(map, id, data) {
  if (map.getSource(id)) {
    map.getSource(id).setData(data);
    return;
  }
  map.addSource(id, { type: 'geojson', data });
}

function addMapLayers(map) {
  ensureSource(map, 'hospitals', EMPTY_COLLECTION);
  ensureSource(map, 'caller', EMPTY_COLLECTION);
  ensureSource(map, 'nearest-route', EMPTY_COLLECTION);
  ensureSource(map, 'active-route', EMPTY_COLLECTION);

  if (!map.getLayer('nearest-route-line')) {
    map.addLayer({
      id: 'nearest-route-line',
      type: 'line',
      source: 'nearest-route',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#ba2d2d',
        'line-width': 4,
        'line-dasharray': [2, 2],
        'line-opacity': 0.88
      }
    });
  }

  if (!map.getLayer('active-route-line')) {
    map.addLayer({
      id: 'active-route-line',
      type: 'line',
      source: 'active-route',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#1f7a54',
        'line-width': 6,
        'line-opacity': 0.95
      }
    });
  }

  if (!map.getLayer('hospital-circles')) {
    map.addLayer({
      id: 'hospital-circles',
      type: 'circle',
      source: 'hospitals',
      paint: {
        'circle-radius': [
          'case',
          ['get', 'recommended'], 13,
          ['get', 'selected'], 12,
          ['get', 'nearest'], 11,
          9
        ],
        'circle-color': [
          'match',
          ['get', 'status'],
          'open', '#2c7a55',
          'caution', '#d99a22',
          'overwhelmed', '#ba2d2d',
          '#6b7378'
        ],
        'circle-stroke-color': [
          'case',
          ['get', 'recommended'], '#0f2027',
          ['get', 'selected'], '#0f2027',
          ['get', 'nearest'], '#ba2d2d',
          '#ffffff'
        ],
        'circle-stroke-width': [
          'case',
          ['any', ['get', 'recommended'], ['get', 'selected'], ['get', 'nearest']], 4,
          2
        ],
        'circle-opacity': 0.96
      }
    });
  }

  if (!map.getLayer('hospital-labels')) {
    map.addLayer({
      id: 'hospital-labels',
      type: 'symbol',
      source: 'hospitals',
      layout: {
        'text-field': ['get', 'shortName'],
        'text-size': 12,
        'text-offset': [0, 1.55],
        'text-anchor': 'top',
        'text-allow-overlap': false
      },
      paint: {
        'text-color': '#16242b',
        'text-halo-color': '#ffffff',
        'text-halo-width': 2
      }
    });
  }

  if (!map.getLayer('caller-circle')) {
    map.addLayer({
      id: 'caller-circle',
      type: 'circle',
      source: 'caller',
      paint: {
        'circle-radius': 10,
        'circle-color': '#182026',
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 4
      }
    });
  }

  if (!map.getLayer('caller-label')) {
    map.addLayer({
      id: 'caller-label',
      type: 'symbol',
      source: 'caller',
      layout: {
        'text-field': ['concat', 'CALL: ', ['get', 'label']],
        'text-size': 12,
        'text-offset': [0, -1.7],
        'text-anchor': 'bottom',
        'text-allow-overlap': true
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': '#182026',
        'text-halo-width': 2
      }
    });
  }
}

export default function Map({
  hospitals,
  selectedHospital,
  onSelectHospital,
  recommendations,
  callLocation,
  onCallLocationChange,
  onCallLocationCommit
}) {
  const mapNode = useRef(null);
  const mapRef = useRef(null);
  const hospitalsRef = useRef([]);
  const callLocationRef = useRef(callLocation);
  const onCallLocationChangeRef = useRef(onCallLocationChange);
  const onCallLocationCommitRef = useRef(onCallLocationCommit);
  const didInitialFit = useRef(false);
  const dragStateRef = useRef({ active: false, lngLat: null });
  const [routeMode, setRouteMode] = useState('recommended');
  const [mapReady, setMapReady] = useState(false);
  const [dragLocation, setDragLocation] = useState(null);
  const topHospitalId = recommendations?.[0]?.hospital_id;

  const effectiveCallLocation = dragLocation || callLocation;
  const caller = useMemo(() => callLngLat(effectiveCallLocation), [effectiveCallLocation]);
  const recommendedHospital = useMemo(
    () => hospitals.find((hospital) => hospital.id === topHospitalId),
    [hospitals, topHospitalId]
  );
  const nearestHospital = useMemo(() => {
    return [...hospitals]
      .filter((hospital) => Number.isFinite(Number(hospital.distance_km)))
      .sort((a, b) => Number(a.distance_km) - Number(b.distance_km))[0];
  }, [hospitals]);

  const focusedHospital =
    routeMode === 'nearest' ? nearestHospital : routeMode === 'selected' ? selectedHospital : recommendedHospital || nearestHospital;

  useEffect(() => {
    hospitalsRef.current = hospitals;
  }, [hospitals]);

  useEffect(() => {
    callLocationRef.current = callLocation;
    onCallLocationChangeRef.current = onCallLocationChange;
    onCallLocationCommitRef.current = onCallLocationCommit;
  }, [callLocation, onCallLocationChange, onCallLocationCommit]);

  useEffect(() => {
    if (!dragStateRef.current.active) {
      setDragLocation(null);
    }
  }, [callLocation]);

  useEffect(() => {
    if (!MAPBOX_TOKEN || mapRef.current || !mapNode.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;
    mapRef.current = new mapboxgl.Map({
      container: mapNode.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [77.5946, 12.9716],
      zoom: 11.2,
      attributionControl: false
    });

    mapRef.current.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'top-right');
    mapRef.current.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');
    mapRef.current.on('load', () => {
      addMapLayers(mapRef.current);
      setMapReady(true);
    });
    mapRef.current.on('click', 'hospital-circles', (event) => {
      const id = event.features?.[0]?.properties?.id;
      const hospital = hospitalsRef.current.find((item) => item.id === id);
      if (hospital) {
        onSelectHospital(hospital);
        setRouteMode('selected');
      }
    });
    mapRef.current.on('mouseenter', 'hospital-circles', () => {
      mapRef.current.getCanvas().style.cursor = 'pointer';
    });
    mapRef.current.on('mouseleave', 'hospital-circles', () => {
      mapRef.current.getCanvas().style.cursor = '';
    });
    mapRef.current.on('mouseenter', 'caller-circle', () => {
      mapRef.current.getCanvas().style.cursor = onCallLocationChangeRef.current ? 'grab' : '';
    });
    mapRef.current.on('mouseleave', 'caller-circle', () => {
      if (!dragStateRef.current.active) {
        mapRef.current.getCanvas().style.cursor = '';
      }
    });
    mapRef.current.on('mousedown', 'caller-circle', (event) => {
      if (!onCallLocationChangeRef.current) return;
      dragStateRef.current = { active: true, lngLat: event.lngLat };
      mapRef.current.getCanvas().style.cursor = 'grabbing';
      mapRef.current.dragPan.disable();
      setDragLocation((current) => ({
        ...(current || callLocationRef.current),
        caller_lat: Number(event.lngLat.lat.toFixed(6)),
        caller_lng: Number(event.lngLat.lng.toFixed(6))
      }));
    });
    mapRef.current.on('mousemove', (event) => {
      if (!dragStateRef.current.active) return;
      dragStateRef.current.lngLat = event.lngLat;
      setDragLocation((current) => ({
        ...(current || callLocationRef.current),
        caller_lat: Number(event.lngLat.lat.toFixed(6)),
        caller_lng: Number(event.lngLat.lng.toFixed(6))
      }));
    });
    mapRef.current.on('mouseup', () => {
      if (!dragStateRef.current.active) return;
      const droppedAt = dragStateRef.current.lngLat;
      dragStateRef.current = { active: false, lngLat: null };
      mapRef.current.dragPan.enable();
      mapRef.current.getCanvas().style.cursor = onCallLocationChangeRef.current ? 'grab' : '';
      if (!droppedAt) return;
      setDragLocation(null);
      onCallLocationChangeRef.current({
        ...callLocationRef.current,
        caller_lat: Number(droppedAt.lat.toFixed(6)),
        caller_lng: Number(droppedAt.lng.toFixed(6))
      });
      onCallLocationCommitRef.current?.();
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [onSelectHospital]);

  useEffect(() => {
    if (recommendedHospital) {
      setRouteMode('recommended');
      onSelectHospital(recommendedHospital);
    }
  }, [recommendedHospital?.id]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;

    ensureSource(map, 'hospitals', hospitalFeatures(hospitals, selectedHospital, topHospitalId, nearestHospital?.id));
    ensureSource(map, 'caller', callerFeature(effectiveCallLocation));
  }, [caller, effectiveCallLocation, hospitals, mapReady, nearestHospital?.id, selectedHospital?.id, topHospitalId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;

    const controller = new AbortController();

    async function updateRoutes() {
      const nearestRoute = nearestHospital
        ? await fetchDirections(caller, hospitalLngLat(nearestHospital), controller.signal)
        : EMPTY_COLLECTION;
      const activeRoute = focusedHospital
        ? await fetchDirections(caller, hospitalLngLat(focusedHospital), controller.signal)
        : EMPTY_COLLECTION;

      ensureSource(map, 'nearest-route', nearestRoute);
      ensureSource(map, 'active-route', activeRoute);

      const fitPoints = [caller];
      if (nearestHospital) fitPoints.push(hospitalLngLat(nearestHospital));
      if (focusedHospital) fitPoints.push(hospitalLngLat(focusedHospital));
      const bounds = fitPoints.reduce(
        (current, point) => current.extend(point),
        new mapboxgl.LngLatBounds(fitPoints[0], fitPoints[0])
      );
      map.fitBounds(bounds, {
        padding: 100,
        maxZoom: 14,
        duration: didInitialFit.current ? 600 : 0
      });
      didInitialFit.current = true;
    }

    updateRoutes();
    return () => controller.abort();
  }, [caller, focusedHospital?.id, mapReady, nearestHospital?.id]);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="mapFullContainer">
        <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: 'var(--red-bright)', fontWeight: 800, fontSize: 13 }}>
          Set VITE_MAPBOX_TOKEN to render the interactive map.
        </div>
      </div>
    );
  }

  return (
    <div className="mapFullContainer">
      {/* 3/4 map area */}
      <div className="cmdMapCanvas">
        {/* Route mode toggle — floated top-left */}
        <div className="mapFloatControls">
          <div className="mapHeader" style={{ padding: 0, border: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.12em', color: 'var(--text-dim)' }}>Bengaluru emergency map</span>
              <strong style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>{effectiveCallLocation?.caller_address || 'MG Road, Bengaluru'}</strong>
            </div>
          </div>
          <div className="mapActions">
            <button className={routeMode === 'recommended' ? 'active' : ''} onClick={() => setRouteMode('recommended')}>
              Recommended
            </button>
            <button className={routeMode === 'nearest' ? 'active' : ''} onClick={() => setRouteMode('nearest')}>
              Nearest
            </button>
          </div>
        </div>

        {/* Route summary — floated bottom-left above legend */}
        <div className="mapFloatSummary">
          <div>
            <span>Solid route</span>
            <strong>{focusedHospital ? focusedHospital.name : 'Run dispatch to draw route'}</strong>
          </div>
          <div>
            <span>ETA</span>
            <strong>{focusedHospital?.eta_minutes ? `${focusedHospital.eta_minutes} min` : '--'}</strong>
          </div>
          <div>
            <span>Wait</span>
            <strong>{focusedHospital?.wait_time_minutes ? `${focusedHospital.wait_time_minutes} min` : '--'}</strong>
          </div>
          <div>
            <span>Treatment</span>
            <strong>
              {focusedHospital?.eta_minutes
                ? `${Number(focusedHospital.eta_minutes) + Number(focusedHospital.wait_time_minutes || 0)} min`
                : '--'}
            </strong>
          </div>
        </div>

        <div ref={mapNode} className="mapFullCanvas" />
        <div className="mapLegend">
          <span><i className="line active" /> NearDead route</span>
          <span><i className="line old" /> nearest-first route</span>
          <span><i className="dot open" /> open</span>
          <span><i className="dot caution" /> caution</span>
          <span><i className="dot overwhelmed" /> overwhelmed</span>
        </div>
      </div>
    </div>
  );
}
