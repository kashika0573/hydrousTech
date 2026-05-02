const DATASET_URL = "https://scoringapi.h2ohackathon.org/Challenge/json";
const fallbackLocations = [
  { name: "Tracy, CA", lat: 37.7397, lng: -121.4252, snowpack: 65, rainfall: 105, reservoir: 72, temp: 89 },
  { name: "Sacramento, CA", lat: 38.5816, lng: -121.4944, snowpack: 78, rainfall: 96, reservoir: 76, temp: 84 },
  { name: "Fresno, CA", lat: 36.7378, lng: -119.7871, snowpack: 62, rainfall: 88, reservoir: 69, temp: 95 }
];
let selectedLocation = null, currentLocations = [];
const weights = { snowpack: 0.3, rainfall: 0.3, reservoir: 0.4 };

const map = L.map("map").setView([37.25, -120.4], 6);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
const markerLayer = L.layerGroup().addTo(map);

const bands = {
  snowpack: [[120, "Excellent"], [90, "Average"], [70, "Below average"], [0, "Concerning"]],
  rainfall: [[110, "Wet"], [90, "Normal"], [70, "Dry"], [0, "Drought signal"]],
  reservoir: [[85, "Strong"], [70, "Healthy"], [50, "Watch level"], [0, "Concern"]]
};

const pct = (v) => (v > 1 ? v : v * 100);
const norm = (v) => Math.max(0, Math.min(1, pct(v) / 100));
function band(type, value){ const p = pct(value); return bands[type].find(([min]) => p >= min)[1]; }
function calcWai(d){ return Math.round((norm(d.snowpack)*weights.snowpack + norm(d.rainfall)*weights.rainfall + norm(d.reservoir)*weights.reservoir)*100); }
function predictWai(w){ return Math.max(0, w - (w<45?13:w<70?9:4)); }
function cls(w){ return w>=70?"wai-safe":w>=40?"wai-warning":"wai-critical"; }
function status(w){ return w>=70?"Safe":w>=40?"Warning":"Critical"; }

function adaptRecord(raw,i){
  const lat=Number(raw.lat??raw.latitude??raw.y), lng=Number(raw.lng??raw.lon??raw.longitude??raw.x);
  if(!Number.isFinite(lat)||!Number.isFinite(lng)) return null;
  return { name: raw.name??raw.location??`Location ${i+1}`, lat, lng, snowpack: Number(raw.snowpack??raw.snow??65), rainfall:Number(raw.rainfall??raw.precip??100), reservoir:Number(raw.reservoir??raw.storage??70), temp:Number(raw.temp??88)};
}

async function loadLocations(){
  try{ const r=await fetch(DATASET_URL); if(!r.ok) throw new Error(`HTTP ${r.status}`); const p=await r.json(); const arr=(Array.isArray(p)?p:p.data)||[]; const data=arr.map(adaptRecord).filter(Boolean); if(!data.length) throw new Error("No valid map rows"); return data; }
  catch(e){ addBot(`Live dataset unavailable (${e.message}). Using fallback sample.`); return fallbackLocations; }
}

function renderMarkers(locs){ markerLayer.clearLayers(); locs.forEach((loc)=>{ const wai=calcWai(loc), color=wai>=70?"#31d96d":wai>=40?"#f7d74b":"#ef5f5f"; const m=L.circleMarker([loc.lat,loc.lng],{radius:10,color,fillColor:color,fillOpacity:.92}).addTo(markerLayer); m.bindTooltip(`${loc.name} • WAI ${wai}`); m.on("click",()=>{ selectedLocation={...loc,wai,prediction:predictWai(wai)}; renderLocation(); setPage("overview"); addBot(`${loc.name} selected.`); }); }); renderScoreTable(); }

function renderLocation(){ if(!selectedLocation) return; document.getElementById("locationCard").innerHTML=`<h3>${selectedLocation.name}</h3><p><b>WAI:</b> <span class='${cls(selectedLocation.wai)}'>${selectedLocation.wai} (${status(selectedLocation.wai)})</span></p><p><b>30-day prediction:</b> ${selectedLocation.prediction}</p><p><b>Snowpack:</b> ${pct(selectedLocation.snowpack).toFixed(0)}% (${band("snowpack",selectedLocation.snowpack)})</p><p><b>Precipitation:</b> ${pct(selectedLocation.rainfall).toFixed(0)}% (${band("rainfall",selectedLocation.rainfall)})</p><p><b>Reservoir:</b> ${pct(selectedLocation.reservoir).toFixed(0)}% (${band("reservoir",selectedLocation.reservoir)})</p>`;
  document.getElementById("benchmarkList").innerHTML=`<li>Snowpack is measured vs April 1 benchmark.</li><li>Precipitation is measured vs historical average.</li><li>Reservoir score depends on capacity + prior carryover.</li>`;
}

function renderScoreTable(){ const body=document.getElementById("scoreTableBody"); body.innerHTML=""; currentLocations.forEach(loc=>{ const wai=calcWai(loc); const tr=document.createElement("tr"); tr.innerHTML=`<td>${loc.name}</td><td class='${cls(wai)}'>${wai}</td><td>${pct(loc.snowpack).toFixed(0)}% (${band("snowpack",loc.snowpack)})</td><td>${pct(loc.rainfall).toFixed(0)}% (${band("rainfall",loc.rainfall)})</td><td>${pct(loc.reservoir).toFixed(0)}% (${band("reservoir",loc.reservoir)})</td><td>${status(wai)}</td>`; body.appendChild(tr); }); }

function add(role,text){ const log=document.getElementById("chatLog"); const p=document.createElement("p"); p.className=`chat-message ${role}`; p.textContent=`${role==="user"?"You":"Hydrous Bot"}: ${text}`; log.appendChild(p); log.scrollTop=log.scrollHeight; }
const addBot=(t)=>add("bot",t);

function answer(msg){ const q=msg.toLowerCase(); if(!selectedLocation) return "Pick a location from the map first so I can provide local context.";
  if(q.includes("explain")||q.includes("status")) return `${selectedLocation.name} is ${status(selectedLocation.wai)} because snowpack ${pct(selectedLocation.snowpack).toFixed(0)}%, precip ${pct(selectedLocation.rainfall).toFixed(0)}%, reservoir ${pct(selectedLocation.reservoir).toFixed(0)}%.`;
  if(q.includes("conservation")||q.includes("advice")) return "Top actions: fix leaks, shorten showers, smart irrigation, and avoid midday watering.";
  if(q.includes("prediction")||q.includes("forecast")) return `Projected WAI in 30 days: ${selectedLocation.prediction}.`;
  if(q.includes("health")) return selectedLocation.wai<40?"Higher dehydration risk in heat. Stay hydrated and reduce outdoor exposure.":"No acute dehydration trigger, but continue water conservation.";
  if(q.includes("compare")) return `Snowpack band: ${band("snowpack",selectedLocation.snowpack)}, precip band: ${band("rainfall",selectedLocation.rainfall)}, reservoir band: ${band("reservoir",selectedLocation.reservoir)}.`;
  return "Try: explain status, forecast, health risk, compare, or conservation advice.";
}

document.getElementById("chatForm").addEventListener("submit",(e)=>{ e.preventDefault(); const i=document.getElementById("chatInput"); const m=i.value.trim(); if(!m) return; add("user",m); addBot(answer(m)); i.value=""; });
document.querySelectorAll('.chip').forEach(c=>c.addEventListener('click',()=>{ const q=c.dataset.q; add('user',q); addBot(answer(q)); }));

function setPage(name){ document.querySelectorAll('.page').forEach(p=>p.classList.remove('active')); document.getElementById(`page-${name}`).classList.add('active'); document.querySelectorAll('.tab-btn').forEach(b=>b.classList.toggle('active',b.dataset.page===name)); }
document.querySelectorAll('.tab-btn').forEach(b=>b.addEventListener('click',()=>setPage(b.dataset.page)));

document.getElementById("openMapBtn").addEventListener("click",()=>{ document.getElementById("mapModal").classList.add("active"); setTimeout(()=>map.invalidateSize(),50); });
document.getElementById("closeMapBtn").addEventListener("click",()=>document.getElementById("mapModal").classList.remove("active"));
document.getElementById("loginForm").addEventListener("submit",(e)=>{ e.preventDefault(); document.getElementById("loginScreen").classList.remove("active"); addBot(`Welcome ${document.getElementById("nameInput").value}.`); });
document.getElementById("refreshDataBtn").addEventListener("click", async()=>{ currentLocations=await loadLocations(); renderMarkers(currentLocations); addBot("Dataset refreshed."); });

(async()=>{ currentLocations=await loadLocations(); renderMarkers(currentLocations); addBot("Assistant+ ready. Open map, pick a place, then ask for advanced insights."); })();
