const statusEl = document.getElementById('status');
const refreshBtn = document.getElementById('refresh');
const fields = {
  callsign: document.getElementById('callsign'),
  origin: document.getElementById('origin'),
  coordinates: document.getElementById('coordinates'),
  altitude: document.getElementById('altitude'),
  speed: document.getElementById('speed'),
  lastContact: document.getElementById('last-contact'),
};

const API_TARGET = 'https://opensky-network.org/api/states/all';
const PROXIES = [
  'https://corsproxy.io/?',
  'https://api.allorigins.win/raw?url=',
];

function updateStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle('error', isError);
}

function formatNumber(value) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
}

function formatTime(timestamp) {
  if (!timestamp) return 'Unknown';
  return new Date(timestamp * 1000).toLocaleString();
}

function formatCoordinate(lat, lon) {
  if (lat == null || lon == null) return 'Unknown';
  return `${lat.toFixed(3)}°, ${lon.toFixed(3)}°`;
}

function metersToFeet(meters) {
  if (meters == null) return null;
  return meters * 3.28084;
}

function metersPerSecondToKnots(speed) {
  if (speed == null) return null;
  return speed * 1.94384;
}

function pickRandomFlight(states = []) {
  const candidates = states
    .map(state => ({
      icao24: state[0],
      callsign: (state[1] || '').trim(),
      originCountry: state[2],
      timePosition: state[3],
      lastContact: state[4],
      longitude: state[5],
      latitude: state[6],
      baroAltitude: state[7],
      onGround: state[8],
      velocity: state[9],
      geoAltitude: state[13],
    }))
    .filter(flight => flight.callsign && !flight.onGround && flight.latitude && flight.longitude);

  if (!candidates.length) {
    return null;
  }

  const index = Math.floor(Math.random() * candidates.length);
  return candidates[index];
}

async function fetchRandomFlight() {
  refreshBtn.disabled = true;
  updateStatus('Fetching live flight data…');

  try {
    const data = await fetchWithFallback();
    const flight = pickRandomFlight(data.states || []);

    if (!flight) {
      updateStatus('No airborne flights available right now. Please try again shortly.', true);
      return;
    }

    const altitude = metersToFeet(flight.geoAltitude ?? flight.baroAltitude);
    const speed = metersPerSecondToKnots(flight.velocity);

    fields.callsign.textContent = flight.callsign || 'Unknown';
    fields.origin.textContent = flight.originCountry || 'Unknown';
    fields.coordinates.textContent = formatCoordinate(flight.latitude, flight.longitude);
    fields.altitude.textContent = altitude ? `${formatNumber(altitude)} ft` : 'Unknown';
    fields.speed.textContent = speed ? `${formatNumber(speed)} knots` : 'Unknown';
    fields.lastContact.textContent = formatTime(flight.lastContact);

    updateStatus(`Showing flight ${flight.callsign} from ${flight.originCountry}. Last contact: ${formatTime(flight.lastContact)}.`);
  } catch (error) {
    console.error(error);
    updateStatus('Unable to fetch flight data right now. Please try again later.', true);
  } finally {
    refreshBtn.disabled = false;
  }
}

async function fetchWithFallback() {
  let lastError = null;

  for (const proxy of PROXIES) {
    try {
      const response = await fetch(proxy + encodeURIComponent(API_TARGET));
      if (!response.ok) {
        throw new Error(`Proxy request failed with status ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';
      const payload = contentType.includes('application/json')
        ? await response.json()
        : JSON.parse(await response.text());

      if (!payload || typeof payload !== 'object' || !payload.states) {
        throw new Error('Malformed response received from proxy');
      }

      return payload;
    } catch (error) {
      console.warn(`Proxy ${proxy} failed:`, error);
      lastError = error;
    }
  }

  throw lastError || new Error('All proxy attempts failed');
}

refreshBtn.addEventListener('click', fetchRandomFlight);
window.addEventListener('DOMContentLoaded', fetchRandomFlight);
