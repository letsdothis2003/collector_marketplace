// ==================== ROUTE SAFETY AI MODULE ====================
import { GEMINI_API_KEY } from './config.js';
import { showToast } from './utils.js';

let genAI = null;

if (GEMINI_API_KEY && GEMINI_API_KEY !== null && GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY_HERE') {
  genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
}

// Get user's current location
export function getUserCurrentLocation() {
  if (!navigator.geolocation) {
    showToast('Geolocation is not supported by your browser', 'error');
    return;
  }
  
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const { latitude, longitude } = position.coords;
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`);
        const data = await response.json();
        const address = data.display_name || `${latitude}, ${longitude}`;
        document.getElementById('user-location').value = address;
        showToast('Location detected!', 'success');
      } catch (err) {
        document.getElementById('user-location').value = `${latitude}, ${longitude}`;
        showToast('Coordinates detected!', 'success');
      }
    },
    (error) => {
      showToast('Unable to get your location. Please enter manually.', 'error');
    }
  );
}

// Calculate route and safety analysis
export async function calculateRouteSafety(pickupLocation, userLocation, transportMethod) {
  const resultDiv = document.getElementById('route-result');
  resultDiv.classList.remove('hidden');
  resultDiv.innerHTML = '<div class="spinner"></div> Analyzing route and safety...';
  
  try {
    // Geocode both locations
    const [pickupCoords, userCoords] = await Promise.all([
      geocodeLocation(pickupLocation),
      geocodeLocation(userLocation)
    ]);
    
    if (!pickupCoords || !userCoords) {
      throw new Error('Could not locate one or both addresses');
    }
    
    // Get route from OSRM
    const routeData = await getRouteFromOSRM(
      userCoords.lon, userCoords.lat,
      pickupCoords.lon, pickupCoords.lat,
      transportMethod
    );
    
    // Get safety analysis
    const safetyAnalysis = await getAreaSafetyAnalysis(pickupLocation, pickupCoords);
    
    // Display results
    displayRouteAnalysis(routeData, safetyAnalysis, pickupLocation, transportMethod);
    
  } catch (err) {
    console.error('Route analysis error:', err);
    resultDiv.innerHTML = `<div class="route-error" style="color:var(--danger);padding:16px;text-align:center;">⚠️ Error analyzing route: ${err.message}. Please try again.</div>`;
  }
}

async function geocodeLocation(location) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}&limit=1`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    }
    return null;
  } catch (err) {
    console.error('Geocoding error:', err);
    return null;
  }
}

async function getRouteFromOSRM(startLon, startLat, endLon, endLat, transportMethod) {
  let profile = 'driving';
  if (transportMethod === 'walking') profile = 'walking';
  
  const url = `https://router.project-osrm.org/route/v1/${profile}/${startLon},${startLat};${endLon},${endLat}?overview=full&geometries=geojson`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.code !== 'Ok') {
      throw new Error('Could not calculate route');
    }
    
    const route = data.routes[0];
    const distanceKm = route.distance / 1000;
    const durationMinutes = Math.round(route.duration / 60);
    const durationHours = Math.floor(durationMinutes / 60);
    const durationMins = durationMinutes % 60;
    
    return {
      distance: distanceKm.toFixed(1),
      duration: durationHours > 0 ? `${durationHours}h ${durationMins}m` : `${durationMins}m`,
      durationMinutes: durationMinutes,
      safetyScore: calculateRouteSafetyScore(distanceKm, durationMinutes, transportMethod)
    };
  } catch (err) {
    console.error('OSRM error:', err);
    throw err;
  }
}

function calculateRouteSafetyScore(distanceKm, durationMinutes, transportMethod) {
  let score = 70;
  
  if (distanceKm > 50) score -= 20;
  else if (distanceKm > 20) score -= 10;
  else if (distanceKm < 5) score += 10;
  
  if (durationMinutes > 60) score -= 15;
  else if (durationMinutes > 30) score -= 5;
  else if (durationMinutes < 15) score += 10;
  
  if (transportMethod === 'walking') score -= 15;
  if (transportMethod === 'transit') score -= 5;
  if (transportMethod === 'driving') score += 5;
  
  return Math.min(100, Math.max(0, score));
}

async function getAreaSafetyAnalysis(location, coords) {
  if (genAI) {
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });
      const prompt = `Analyze the safety of this area for a marketplace pickup: "${location}" at coordinates ${coords.lat}, ${coords.lon}.
      
      Return a JSON object with:
      {
        "safetyRating": "Safe / Moderate / Caution",
        "safetyScore": 0-100,
        "recommendations": ["tip1", "tip2", "tip3"],
        "nearbySafeSpots": "suggested meeting places"
      }`;
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (err) {
      console.warn('Gemini safety analysis failed, using fallback');
    }
  }
  
  // Fallback safety analysis
  return {
    safetyRating: "Moderate",
    safetyScore: 65,
    recommendations: [
      "Meet during daylight hours",
      "Bring a friend if possible",
      "Share your location with someone you trust"
    ],
    nearbySafeSpots: "Police stations, bank lobbies, or busy shopping centers are recommended meeting spots"
  };
}

function displayRouteAnalysis(routeData, safetyAnalysis, pickupLocation, transportMethod) {
  const resultDiv = document.getElementById('route-result');
  
  const safetyColor = safetyAnalysis.safetyScore >= 70 ? 'var(--neon)' : 
                     (safetyAnalysis.safetyScore >= 50 ? 'var(--warning)' : 'var(--danger)');
  
  const routeSafetyColor = routeData.safetyScore >= 70 ? 'var(--neon)' : 
                          (routeData.safetyScore >= 50 ? 'var(--warning)' : 'var(--danger)');
  
  const transportIcon = {
    'driving': '🚗',
    'walking': '🚶',
    'transit': '🚌'
  }[transportMethod] || '🚗';
  
  resultDiv.innerHTML = `
    <div class="route-analysis-card" style="margin-top:16px; animation:fadeIn 0.3s ease;">
      <div style="background:var(--bg-3); border-radius:var(--radius-lg); padding:16px;">
        <h4 style="color:var(--neon); margin-bottom:12px;">🗺️ Route Analysis</h4>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px;">
          <div><strong>${transportIcon} Distance:</strong><br>${routeData.distance} km</div>
          <div><strong>⏱️ Duration:</strong><br>${routeData.duration}</div>
          <div><strong>🚦 Route Safety:</strong><br><span style="color:${routeSafetyColor}; font-weight:bold;">${routeData.safetyScore}%</span></div>
        </div>
        
        <h4 style="color:var(--neon); margin-bottom:12px; margin-top:16px;">🛡️ Area Safety Analysis</h4>
        <div style="background:${safetyColor}10; padding:12px; border-radius:var(--radius); margin-bottom:12px;">
          <div><strong>📍 ${escHtml(pickupLocation)}</strong></div>
          <div style="margin-top:8px;"><strong>Safety Rating:</strong> <span style="color:${safetyColor};">${safetyAnalysis.safetyRating} (${safetyAnalysis.safetyScore}%)</span></div>
        </div>
        
        <div><strong>📋 Recommendations:</strong></div>
        <ul style="margin-top:8px; padding-left:20px;">
          ${safetyAnalysis.recommendations.map(rec => `<li>${escHtml(rec)}</li>`).join('')}
        </ul>
        
        <div style="margin-top:12px; padding:8px; background:rgba(0,255,65,0.05); border-radius:var(--radius);">
          <strong>📍 Safe Meeting Spots Nearby:</strong><br>
          ${escHtml(safetyAnalysis.nearbySafeSpots)}
        </div>
        
        <div style="margin-top:16px; padding-top:12px; border-top:1px solid var(--border); font-size:12px; color:var(--text-muted);">
          ⚠️ Always prioritize your safety. Meet in public places, during daylight, and bring a friend when possible.
        </div>
      </div>
    </div>
  `;
  
  resultDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}