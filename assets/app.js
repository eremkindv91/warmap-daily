const paths = {
  status: 'data/status.json', current: 'data/current.geojson', changes: 'data/changes.geojson',
  settlements: 'data/settlements.json', events: 'data/events.json', sources: 'data/sources.json'
};

const state = { period: 'day', layers: {}, data: {} };
const $ = (id) => document.getElementById(id);
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const formatDate = (iso) => iso ? new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',year:'numeric'}).format(new Date(`${iso}T12:00:00Z`)) : 'нет опубликованных данных';
const formatTime = (iso) => iso ? new Intl.DateTimeFormat('ru-RU',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Moscow'}).format(new Date(iso)) + ' МСК' : 'Публикаций ещё нет';

const map = L.map('map', { zoomControl: false, minZoom: 5 }).setView([48.7, 35.2], 6);
L.control.zoom({position:'topright'}).addTo(map);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 13, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

const layerStyle = feature => {
  const type = feature.properties?.status || feature.properties?.layer || 'unknown';
  const styles = {
    control_ru:{color:'#9e3f37',fillColor:'#bd584c',fillOpacity:.34,weight:1},
    control_ua:{color:'#345a86',fillColor:'#4770a2',fillOpacity:.28,weight:1},
    contested:{color:'#b0711f',fillColor:'#d89b3c',fillOpacity:.42,weight:1,dashArray:'5 4'},
    unknown:{color:'#737b76',fillColor:'#9ca39f',fillOpacity:.25,weight:1,dashArray:'3 5'},
    change:{color:'#587020',fillColor:'#b9db57',fillOpacity:.7,weight:2}
  };
  return styles[type] || styles.unknown;
};

function popup(feature, layer) {
  const p = feature.properties || {};
  layer.bindPopup(`<strong>${escapeHtml(p.name || 'Изменение')}</strong><br><small>${escapeHtml(p.summary || '')}</small><br><small>Confidence: ${escapeHtml(p.confidence ?? '—')}</small>`);
}

async function getJson(url, fallback) {
  try { const response = await fetch(`${url}?v=${Date.now()}`); if (!response.ok) throw new Error(response.status); return await response.json(); }
  catch (error) { console.warn(`Не удалось загрузить ${url}`, error); return fallback; }
}

function renderStatus(status, changes, settlements, events) {
  const date = status.snapshot_date || null;
  $('snapshotDate').textContent = formatDate(date);
  $('mapDate').textContent = formatDate(date);
  $('snapshotTime').textContent = formatTime(status.published_at);
  $('freshnessLabel').textContent = status.state === 'current' ? 'ДАННЫЕ АКТУАЛЬНЫ' : status.state === 'stale' ? 'ДАННЫЕ УСТАРЕЛИ' : 'ОЖИДАЕТСЯ ПЕРВЫЙ СНИМОК';
  $('areaDay').textContent = `${Number(status.area_change_km2 || 0).toLocaleString('ru-RU',{maximumFractionDigits:1})} км²`;
  $('settlementCount').textContent = settlements.length;
  $('eventCount').textContent = events.filter(e => e.verification_status === 'confirmed').length;
  $('disputedCount').textContent = events.filter(e => e.verification_status === 'claim' || e.verification_status === 'disputed').length;
  $('mapEmpty').hidden = Boolean((state.data.current?.features?.length || 0) + (changes.features?.length || 0));
}

function renderMap(current, changes) {
  state.layers.control = L.geoJSON(current,{style:layerStyle,onEachFeature:popup}).addTo(map);
  state.layers.change = L.geoJSON(changes,{style:f=>layerStyle({...f,properties:{...f.properties,layer:'change'}}),onEachFeature:popup}).addTo(map);
  const all = L.featureGroup([state.layers.control,state.layers.change]);
  if (all.getLayers().some(l => l.getLayers ? l.getLayers().length : true)) {
    const bounds = all.getBounds(); if (bounds.isValid()) map.fitBounds(bounds.pad(.12));
  }
}

function renderChanges(period = state.period) {
  const all = state.data.changes?.features || [];
  const now = new Date(state.data.status?.snapshot_date || Date.now());
  const days = {day:1,week:7,month:30}[period];
  const items = all.filter(f => !f.properties?.date || (now - new Date(`${f.properties.date}T00:00:00Z`)) / 86400000 <= days);
  $('changeBadge').textContent = items.length;
  $('changeList').innerHTML = items.length ? items.map(f => { const p=f.properties||{}; return `<article class="change-item"><time>${escapeHtml(p.date||'')}</time><h4>${escapeHtml(p.name||'Территориальное изменение')}</h4><p>${escapeHtml(p.summary||'')}</p><span class="confidence">confidence ${escapeHtml(p.confidence??'—')}</span></article>`; }).join('') : '<div class="empty-state">За выбранный период нет опубликованных подтверждённых изменений.</div>';
}

function renderEvents(events) {
  const verified = events.filter(e => ['confirmed','probable'].includes(e.verification_status));
  const claims = events.filter(e => ['claim','disputed'].includes(e.verification_status));
  $('eventBadge').textContent = verified.length;
  $('eventList').innerHTML = verified.length ? verified.map(e => `<article class="event-card"><time>${escapeHtml(e.event_date||'')}</time><h3>${escapeHtml(e.title)}</h3><p>${escapeHtml(e.summary)}</p></article>`).join('') : '<div class="empty-state">Подтверждённых событий пока нет.</div>';
  $('claimList').innerHTML = claims.length ? claims.map(e => `<article class="claim-card"><span class="side">${escapeHtml(e.side_label||'Источник')}</span><p>${escapeHtml(e.summary)}</p>${e.source_url?`<a href="${encodeURI(e.source_url)}" target="_blank" rel="noopener noreferrer">Открыть первоисточник ↗</a>`:''}</article>`).join('') : '<div class="empty-state">Неподтверждённых или спорных заявлений пока нет.</div>';
}

function renderSources(sources) {
  $('sourceGrid').innerHTML = sources.map(s => `<article class="source-card"><header><div><h3>${escapeHtml(s.name)}</h3><p>${escapeHtml(s.role)}</p></div><i class="health ${escapeHtml(s.health)}" title="${escapeHtml(s.health_label)}"></i></header><p>${escapeHtml(s.usage_note)}</p><a href="${encodeURI(s.url)}" target="_blank" rel="noopener noreferrer">Перейти к источнику ↗</a></article>`).join('');
}

async function init() {
  const [status,current,changes,settlements,events,sources] = await Promise.all([
    getJson(paths.status,{}), getJson(paths.current,{type:'FeatureCollection',features:[]}), getJson(paths.changes,{type:'FeatureCollection',features:[]}), getJson(paths.settlements,[]), getJson(paths.events,[]), getJson(paths.sources,[])
  ]);
  state.data={status,current,changes,settlements,events,sources};
  renderMap(current,changes); renderStatus(status,changes,settlements,events); renderChanges(); renderEvents(events); renderSources(sources);
}

document.querySelectorAll('[data-period]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-period]').forEach(b=>b.classList.remove('active')); button.classList.add('active'); state.period=button.dataset.period; renderChanges();
}));
document.querySelectorAll('[data-layer]').forEach(button => button.addEventListener('click', () => {
  const key=button.dataset.layer; const group=key==='change'?state.layers.change:state.layers.control; if(!group)return;
  if(map.hasLayer(group)){map.removeLayer(group);button.classList.add('off')}else{group.addTo(map);button.classList.remove('off')}
}));
$('aboutButton').addEventListener('click',()=>$('aboutDialog').showModal());
$('closeAbout').addEventListener('click',()=>$('aboutDialog').close());
init();
