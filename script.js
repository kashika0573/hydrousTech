const locations = [
  { name: "Tracy, CA", lat: 37.7397, lng: -121.4252, snowpack: 0.35, rainfall: 0.38, reservoir: 0.42, temp: 89 },
  { name: "Sacramento, CA", lat: 38.5816, lng: -121.4944, snowpack: 0.55, rainfall: 0.52, reservoir: 0.61, temp: 84 },
  { name: "Fresno, CA", lat: 36.7378, lng: -119.7871, snowpack: 0.28, rainfall: 0.31, reservoir: 0.45, temp: 95 },
  { name: "Bakersfield, CA", lat: 35.3733, lng: -119.0187, snowpack: 0.24, rainfall: 0.29, reservoir: 0.37, temp: 97 },
  { name: "San Jose, CA", lat: 37.3382, lng: -121.8863, snowpack: 0.49, rainfall: 0.5, reservoir: 0.58, temp: 82 }
];

const weights = { snowpack: 0.3, rainfall: 0.3, reservoir: 0.4 };
let selectedLocation = null;

function calcWai(d) {
  return Math.round((d.snowpack * weights.snowpack + d.rainfall * weights.rainfall + d.reservoir * weights.reservoir) * 100);
}

function predictWai(current) {
  const weeklyDrop = current < 45 ? 3 : current < 70 ? 2 : 1;
  return Math.max(0, current - Math.round((weeklyDrop * 30) / 7));
}

function statusClass(wai) {
  if (wai >= 70) return "wai-safe";
  if (wai >= 40) return "wai-warning";
  return "wai-critical";
}

function riskLabel(wai) {
  if (wai >= 70) return "Safe";
  if (wai >= 40) return "Warning";
  return "Critical";
}

const map = L.map("map").setView([37.25, -120.4], 6);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 18,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

locations.forEach((loc) => {
  const wai = calcWai(loc);
  const color = wai >= 70 ? "#31d96d" : wai >= 40 ? "#f7d74b" : "#ef5f5f";
  const marker = L.circleMarker([loc.lat, loc.lng], {
    radius: 10,
    color,
    fillColor: color,
    fillOpacity: 0.92
  }).addTo(map);

  marker.bindTooltip(`${loc.name} • WAI ${wai}`, { direction: "top" });

  marker.on("click", () => {
    selectedLocation = { ...loc, wai, prediction: predictWai(wai) };
    renderLocation();
    addBotMessage(`${loc.name} selected. Ask me for explanation, advice, or health risk details.`);
  });
});

function renderLocation() {
  const card = document.getElementById("locationCard");
  if (!selectedLocation) return;
  const health = selectedLocation.wai < 40 && selectedLocation.temp > 90
    ? "⚠️ High dehydration risk: low water availability + high heat can increase kidney stress and heat illness risk."
    : "No acute heat-dehydration trigger at this moment.";

  card.innerHTML = `
    <h3>${selectedLocation.name}</h3>
    <p><strong>WAI:</strong> <span class="${statusClass(selectedLocation.wai)}">${selectedLocation.wai} (${riskLabel(selectedLocation.wai)})</span></p>
    <p><strong>30-day prediction:</strong> <span class="${statusClass(selectedLocation.prediction)}">${selectedLocation.prediction}</span></p>
    <p><strong>Insight:</strong> Low rainfall and declining reservoir levels are the main stress drivers when WAI is low.</p>
    <p><strong>Health Signal:</strong> ${health}</p>
  `;
}

function addMessage(role, text) {
  const wrap = document.getElementById("chatLog");
  const p = document.createElement("p");
  p.className = `chat-message ${role}`;
  p.textContent = `${role === "user" ? "You" : "Hydrous Bot"}: ${text}`;
  wrap.appendChild(p);
  wrap.scrollTop = wrap.scrollHeight;
}

function addBotMessage(text) { addMessage("bot", text); }

document.getElementById("chatForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = document.getElementById("chatInput");
  const msg = input.value.trim();
  if (!msg) return;
  addMessage("user", msg);

  const lower = msg.toLowerCase();
  let reply = "I can explain WAI, give conservation advice, and assess dehydration risk.";

  if (!selectedLocation) {
    reply = "Please click a map location first so I can answer with local data.";
  } else if (lower.includes("why") || lower.includes("red") || lower.includes("explain")) {
    reply = `${selectedLocation.name} is ${riskLabel(selectedLocation.wai).toLowerCase()} because snowpack, rainfall, and reservoir levels combine to WAI ${selectedLocation.wai}.`;
  } else if (lower.includes("advice") || lower.includes("what should i do") || lower.includes("conserve")) {
    reply = "Reduce outdoor watering, fix leaks fast, run full laundry loads, and shift high-water use to cooler hours.";
  } else if (lower.includes("danger") || lower.includes("health") || lower.includes("dehydration")) {
    reply = selectedLocation.wai < 40
      ? "Low water raises dehydration risk. Dehydration lowers blood volume, so heart rate can rise to maintain circulation (CO = HR × SV)."
      : "Current risk is moderate. Stay hydrated and monitor heat alerts as conditions change.";
  } else if (lower.includes("predict") || lower.includes("future")) {
    reply = `Projected 30-day WAI for ${selectedLocation.name} is ${selectedLocation.prediction}, based on short-term trend decline.`;
  }

  addBotMessage(reply);
  input.value = "";
});

document.getElementById("loginForm").addEventListener("submit", (e) => {
  e.preventDefault();
  document.getElementById("loginScreen").classList.remove("active");
  const name = document.getElementById("nameInput").value;
  addBotMessage(`Welcome ${name}. Select a location on the map to begin.`);
});


const mapModal = document.getElementById("mapModal");
document.getElementById("openMapBtn").addEventListener("click", () => {
  mapModal.classList.add("active");
  setTimeout(() => map.invalidateSize(), 50);
});
document.getElementById("closeMapBtn").addEventListener("click", () => {
  mapModal.classList.remove("active");
});
