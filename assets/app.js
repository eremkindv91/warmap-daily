const paths = {
  status: 'data/status.json', current: 'data/current.geojson', referenceControl: 'data/reference-control.geojson', previous: 'data/previous.geojson',
  changes: 'data/changes.geojson', updates: 'data/updates.geojson', settlements: 'data/settlements.json', events: 'data/events.json',
  claims: 'data/claims.json', evidence: 'data/evidence.json', sources: 'data/sources.json',
  settlementIndex: 'data/settlements-index.json', sourceHealth: 'data/source-health.json',
  manifest: 'data/snapshots/index.json', audit: 'data/audit-log.json'
};

const emptyGeojson = () => ({type:'FeatureCollection',features:[]});
const state = { period:'day', sourceFilter:'all', layers:{}, layerVisibility:{previous:false}, data:{}, archive:'current', language:'ru', lowBandwidth:false };
const $ = id => document.getElementById(id);
const escapeHtml = (value='') => String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const safeUrl = value => { try { const url=new URL(value,location.href); return url.protocol==='https:' ? url.href : '#'; } catch { return '#'; } };
const locale = () => ({ru:'ru-RU',uk:'uk-UA',en:'en-GB'})[state.language]||'ru-RU';
const formatDate = iso => iso ? new Intl.DateTimeFormat(locale(),{day:'numeric',month:'long',year:'numeric'}).format(new Date(`${iso}T12:00:00Z`)) : i18n[state.language].no_published;
const formatTime = iso => iso ? new Intl.DateTimeFormat(locale(),{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Moscow'}).format(new Date(iso))+' МСК' : i18n[state.language].no_publications;
const formatArea = value => `${Number(value||0).toLocaleString('ru-RU',{maximumFractionDigits:1})} км²`;
const announce = message => { $('appStatus').textContent=message; };

const i18n = {
  ru:{nav_map:'Карта',nav_changes:'Изменения',nav_events:'События',nav_sources:'Источники',nav_archive:'Архив',nav_method:'Методика',about:'О проекте',safety_delay:'Данные публикуются с задержкой не менее 24 часов.',safety_use:'Не используйте карту для навигации, эвакуации или решений, связанных с безопасностью.',hero_title:'Что изменилось<br><em>за последние сутки</em>',hero_lede:'Ежедневный снимок линии контроля с задержкой, источниками и отдельной маркировкой заявлений сторон.',last_snapshot:'Последнее опубликованное обновление',version:'Версия',confirmed_area:'подтверждённая площадь',new_statuses:'Новые точки',settlements:'населённых пунктов',events:'События',confirmed_day:'проверено и опубликовано',disputed_claims:'Спорные заявления',no_geometry:'не меняют геометрию',control_map:'КАРТА ИЗМЕНЕНИЙ',state_on:'Данные на',hours24:'24 часа',days7:'7 дней',days30:'30 дней',download:'Скачать GeoJSON обновлений',no_geometry_title:'Проверенных данных пока нет',no_geometry_text:'Базовая карта доступна; точечные обновления появятся после 24-часовой задержки.',search_placeholder:'Найти населённый пункт на русском, украинском или английском',bandwidth:'Экономия трафика',bandwidth_on:'Экономия трафика: включена',no_search:'Совпадений не найдено',no_published:'нет опубликованных данных',no_publications:'Публикаций ещё нет',fresh_empty:'ОЖИДАЮТСЯ ДАННЫЕ',fresh_points:'ГЕОЛОКИРОВАННЫЕ ОБНОВЛЕНИЯ',fresh_current:'ДАННЫЕ АКТУАЛЬНЫ',fresh_stale:'ДАННЫЕ УСТАРЕЛИ',area_day:'Изменение за сутки',area_week:'Изменение за 7 дней',area_month:'Изменение за 30 дней'},
  uk:{nav_map:'Мапа',nav_changes:'Зміни',nav_events:'Події',nav_sources:'Джерела',nav_archive:'Архів',nav_method:'Методика',about:'Про проєкт',safety_delay:'Дані публікуються із затримкою щонайменше 24 години.',safety_use:'Не використовуйте мапу для навігації, евакуації чи рішень, пов’язаних із безпекою.',hero_title:'Що змінилося<br><em>за останню добу</em>',hero_lede:'Щоденний знімок лінії контролю із затримкою, джерелами та окремим маркуванням заяв сторін.',last_snapshot:'Останнє опубліковане оновлення',version:'Версія',confirmed_area:'підтверджена площа',new_statuses:'Нові точки',settlements:'населених пунктів',events:'Події',confirmed_day:'перевірено й опубліковано',disputed_claims:'Спірні заяви',no_geometry:'не змінюють геометрію',control_map:'МАПА ЗМІН',state_on:'Дані станом на',hours24:'24 години',days7:'7 днів',days30:'30 днів',download:'Завантажити GeoJSON оновлень',no_geometry_title:'Перевірених даних поки немає',no_geometry_text:'Базова мапа доступна; точкові оновлення з’являться після 24-годинної затримки.',search_placeholder:'Знайти населений пункт українською, російською або англійською',bandwidth:'Економія трафіку',bandwidth_on:'Економія трафіку: увімкнено',no_search:'Збігів не знайдено',no_published:'немає опублікованих даних',no_publications:'Публікацій ще немає',fresh_empty:'ОЧІКУЮТЬСЯ ДАНІ',fresh_points:'ГЕОЛОКОВАНІ ОНОВЛЕННЯ',fresh_current:'ДАНІ АКТУАЛЬНІ',fresh_stale:'ДАНІ ЗАСТАРІЛИ',area_day:'Зміна за добу',area_week:'Зміна за 7 днів',area_month:'Зміна за 30 днів'},
  en:{nav_map:'Map',nav_changes:'Changes',nav_events:'Events',nav_sources:'Sources',nav_archive:'Archive',nav_method:'Methodology',about:'About',safety_delay:'Data is published with a delay of at least 24 hours.',safety_use:'Do not use this map for navigation, evacuation, or safety-related decisions.',hero_title:'What changed<br><em>in the last 24 hours</em>',hero_lede:'A daily control-line snapshot with publication delay, linked sources, and separate labels for each side’s claims.',last_snapshot:'Latest published update',version:'Version',confirmed_area:'confirmed area',new_statuses:'New points',settlements:'settlements',events:'Events',confirmed_day:'reviewed and published',disputed_claims:'Disputed claims',no_geometry:'do not change geometry',control_map:'CHANGE MAP',state_on:'Data as of',hours24:'24 hours',days7:'7 days',days30:'30 days',download:'Download updates GeoJSON',no_geometry_title:'No reviewed data yet',no_geometry_text:'The basemap is available. Point updates appear after the 24-hour delay.',search_placeholder:'Find a settlement in Ukrainian, Russian, or English',bandwidth:'Low bandwidth',bandwidth_on:'Low bandwidth: on',no_search:'No matches found',no_published:'no published data',no_publications:'No publications yet',fresh_empty:'AWAITING DATA',fresh_points:'GEOLOCATED UPDATES',fresh_current:'DATA IS CURRENT',fresh_stale:'DATA IS STALE',area_day:'Change in 24 hours',area_week:'Change in 7 days',area_month:'Change in 30 days'}
};
Object.assign(i18n.ru,{legend_ru:'Контроль российских сил',legend_reference_ru:'Оценка контроля РФ · 24.04.2026',legend_ua:'Контроль украинских сил',legend_contested:'Оспариваемая зона',legend_unknown:'Неопределённо',legend_change:'Новое изменение',legend_previous:'Предыдущая граница',legend_events:'Геолокированные обновления',changes_kicker:'ИЗМЕНЕНИЯ',selected_period:'За выбранный период',chronology:'ХРОНОЛОГИЯ',key_events:'Ключевые события',disagreements:'РАСХОЖДЕНИЯ',side_claims:'Заявления сторон',claim_note:'Заявление подтверждает лишь факт публикации. Без независимой проверки оно не меняет карту.',transparency:'ПРОЗРАЧНОСТЬ',sources_title:'Источники и состояние сбора',sources_note:'Для каждого источника показаны роль, лицензия и время последней успешной проверки.',filter_all:'Все',filter_ru:'Российская сторона',filter_ua:'Украинская сторона',filter_independent:'Независимые',daily_archive:'ЕЖЕДНЕВНЫЙ АРХИВ',archive_title:'Версии карты и контрольные суммы',archive_note:'Каждый опубликованный снимок хранит дату, площадь изменений и SHA-256. Выберите дату, чтобы открыть состояние карты на тот день.',snapshot_date:'Дата снимка',current_snapshot:'Текущие данные',methodology:'МЕТОДИКА',method_title:'Автоматический сбор.<br>Ручное решение по геометрии.',no_changes:'За выбранный период нет опубликованных территориальных обновлений.',total_changes:'Полигональная площадь',no_events:'Проверенных событий пока нет.',no_claims:'Неподтверждённых или спорных заявлений пока нет.',no_sources:'Источники этой категории не настроены.',archive_empty:'Архив полигональных снимков появится после первой подтверждённой публикации.',archive_current:'Открыты текущие данные.',download:'Скачать GeoJSON карты',point_only:'Яркие точки — более новые сообщения, а не границы контроля.',reference_notice_title:'Закрашенный слой от 24 апреля 2026',reference_notice_text:'Открытая оценка Wikimedia Commons; яркие точки поверх — более новые сообщения, а не границы.',single_source:'Оценка одного OSINT-источника'});
Object.assign(i18n.uk,{legend_ru:'Контроль російських сил',legend_ua:'Контроль українських сил',legend_contested:'Спірна зона',legend_unknown:'Невизначено',legend_change:'Нова зміна',legend_previous:'Попередня межа',legend_events:'Підтверджені події',changes_kicker:'ЗМІНИ',selected_period:'За вибраний період',chronology:'ХРОНОЛОГІЯ',key_events:'Ключові події',disagreements:'РОЗБІЖНОСТІ',side_claims:'Заяви сторін',claim_note:'Заява підтверджує лише факт публікації. Без незалежної перевірки вона не змінює мапу.',transparency:'ПРОЗОРІСТЬ',sources_title:'Джерела та стан збору',sources_note:'Для кожного джерела показано роль, ліцензію та час останньої успішної перевірки.',filter_all:'Усі',filter_ru:'Російська сторона',filter_ua:'Українська сторона',filter_independent:'Незалежні',daily_archive:'ЩОДЕННИЙ АРХІВ',archive_title:'Версії мапи та контрольні суми',archive_note:'Кожен опублікований знімок зберігає дату, площу змін і SHA-256. Виберіть дату, щоб відкрити стан мапи на той день.',snapshot_date:'Дата знімка',current_snapshot:'Поточний знімок',methodology:'МЕТОДИКА',method_title:'Автоматичний збір.<br>Ручне рішення щодо геометрії.',no_changes:'За вибраний період немає опублікованих підтверджених змін.',total_changes:'Загальна площа змін',no_events:'Підтверджених подій поки немає.',no_claims:'Непідтверджених або спірних заяв поки немає.',no_sources:'Джерела цієї категорії не налаштовано.',archive_empty:'Архів з’явиться після першої підтвердженої публікації.',archive_current:'Відкрито поточний опублікований знімок.'});
Object.assign(i18n.uk,{legend_reference_ru:'Оцінка контролю РФ · 24.04.2026',download:'Завантажити GeoJSON мапи',point_only:'Яскраві точки — новіші повідомлення, а не межі контролю.',reference_notice_title:'Зафарбований шар від 24 квітня 2026',reference_notice_text:'Відкрита оцінка Wikimedia Commons; яскраві точки зверху — новіші повідомлення, а не межі.'});
Object.assign(i18n.en,{legend_ru:'Russian forces control',legend_ua:'Ukrainian forces control',legend_contested:'Contested area',legend_unknown:'Unknown',legend_change:'New change',legend_previous:'Previous boundary',legend_events:'Confirmed events',changes_kicker:'CHANGES',selected_period:'Selected period',chronology:'TIMELINE',key_events:'Key events',disagreements:'DISAGREEMENTS',side_claims:'Claims by side',claim_note:'A claim confirms only that a statement was published. It does not change the map without independent review.',transparency:'TRANSPARENCY',sources_title:'Sources and collection status',sources_note:'Each source shows its role, licence status, and latest availability check.',filter_all:'All',filter_ru:'Russian side',filter_ua:'Ukrainian side',filter_independent:'Independent',daily_archive:'DAILY ARCHIVE',archive_title:'Map versions and checksums',archive_note:'Every published snapshot records its date, changed area, and SHA-256. Select a date to open the map as it appeared that day.',snapshot_date:'Snapshot date',current_snapshot:'Current snapshot',methodology:'METHODOLOGY',method_title:'Automated collection.<br>Human geometry decision.',no_changes:'No confirmed changes were published for this period.',total_changes:'Total changed area',no_events:'No confirmed events yet.',no_claims:'No unconfirmed or disputed claims yet.',no_sources:'No sources are configured for this category.',archive_empty:'The archive will appear after the first confirmed publication.',archive_current:'Current published snapshot is open.'});
Object.assign(i18n.en,{legend_reference_ru:'RF control estimate · 24 Apr 2026',download:'Download map GeoJSON',point_only:'Bright points are newer reports, not control boundaries.',reference_notice_title:'Shaded layer dated 24 April 2026',reference_notice_text:'Open Wikimedia Commons estimate; bright points above it are newer reports, not boundaries.'});

const map = L.map('map',{zoomControl:false,minZoom:5,maxZoom:14}).setView([48.7,35.2],6);
L.control.zoom({position:'topright'}).addTo(map);
L.control.scale({imperial:false,position:'bottomright'}).addTo(map);
const baseLayer=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
  maxZoom:14,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);
map.attributionControl.addAttribution('<a href="https://commons.wikimedia.org/wiki/File:2022_Russian_invasion_of_Ukraine.svg" target="_blank" rel="noopener">Viewsridge / Wikimedia Commons</a> · CC BY-SA 4.0');

const styles = {
  reference_ru:{color:'#8f332d',fillColor:'#bd584c',fillOpacity:.40,weight:1.2},
  control_ru:{color:'#9e3f37',fillColor:'#bd584c',fillOpacity:.34,weight:1},
  control_ua:{color:'#345a86',fillColor:'#4770a2',fillOpacity:.28,weight:1},
  contested:{color:'#a96c1d',fillColor:'#d89b3c',fillOpacity:.42,weight:1,dashArray:'5 4'},
  unknown:{color:'#737b76',fillColor:'#9ca39f',fillOpacity:.24,weight:1,dashArray:'3 5'},
  change:{color:'#4d6811',fillColor:'#b9db57',fillOpacity:.72,weight:2},
  previous:{color:'#27312b',fillOpacity:0,weight:2,dashArray:'7 6',opacity:.75}
};
const layerStyle = feature => styles[feature.properties?.layer||feature.properties?.status||'unknown']||styles.unknown;

function popup(feature,layer){
  const p=feature.properties||{};
  const sources=(p.source_ids||[]).map(id=>escapeHtml(sourceName(id))).join(', ');
  layer.bindPopup(`<div class="map-popup"><strong>${escapeHtml(p.name||'Территориальная оценка')}</strong>${p.summary?`<p>${escapeHtml(p.summary)}</p>`:''}<dl><dt>Статус</dt><dd>${escapeHtml(statusLabel(p.to_status||p.status))}</dd>${p.reference_date?`<dt>Дата слоя</dt><dd>${escapeHtml(formatDate(p.reference_date))}</dd>`:''}<dt>Площадь</dt><dd>${p.area_km2!=null?formatArea(p.area_km2):'—'}</dd><dt>Confidence</dt><dd>${p.confidence!=null?Number(p.confidence).toFixed(2):'—'}</dd>${sources?`<dt>Источник</dt><dd>${sources}</dd>`:''}${p.license?`<dt>Лицензия</dt><dd>${escapeHtml(p.license)}</dd>`:''}</dl></div>`);
}

function statusLabel(status){
  const labels={
    ru:{reference_ru:'Датированная оценка контроля РФ',control_ru:'Контроль российских сил',control_ua:'Контроль украинских сил',contested:'Оспариваемая зона',unknown:'Неопределённо'},
    uk:{reference_ru:'Датована оцінка контролю РФ',control_ru:'Контроль російських сил',control_ua:'Контроль українських сил',contested:'Спірна зона',unknown:'Невизначено'},
    en:{reference_ru:'Dated RF control estimate',control_ru:'Russian forces control',control_ua:'Ukrainian forces control',contested:'Contested',unknown:'Unknown'}
  };
  return labels[state.language]?.[status]||({ru:'Не указан',uk:'Не вказано',en:'Not specified'})[state.language];
}
function sourceName(id){return state.data.sources?.find(source=>source.id===id)?.name||id;}
function settlementName(item){return item[`name_${state.language}`]||item.name||item.name_uk||item.name_ru||item.name_en||'Без названия';}
function eventTitle(item){return item[`title_${state.language}`]||item.title;}
function eventSummary(item){return item[`summary_${state.language}`]||item.summary;}
function eventStatusLabel(status){
  const labels={
    ru:{confirmed:'Подтверждено',probable:'Оценка одного OSINT-источника',corrected:'Уточнено'},
    uk:{confirmed:'Підтверджено',probable:'Оцінка одного OSINT-джерела',corrected:'Уточнено'},
    en:{confirmed:'Confirmed',probable:'Single-source OSINT assessment',corrected:'Corrected'}
  };
  return labels[state.language]?.[status]||status;
}

async function getJson(url,fallback,quiet=false){
  try{const response=await fetch(`${url}${url.includes('?')?'&':'?'}v=${Date.now()}`);if(!response.ok)throw new Error(`HTTP ${response.status}`);return await response.json();}
  catch(error){if(!quiet)console.warn(`Не удалось загрузить ${url}`,error);return fallback;}
}

function clearOperationalLayers(){
  Object.values(state.layers).forEach(layer=>{if(layer&&map.hasLayer(layer))map.removeLayer(layer)});
  state.layers={};
}

function addGeoLayer(key,collection,styleOverride){
  const layer=L.geoJSON(collection,{style:styleOverride||layerStyle,onEachFeature:popup});
  state.layers[key]=layer;
  const visible=state.layerVisibility[key]!==false;
  if(visible)layer.addTo(map);
  return layer;
}

function renderMap(current,referenceControl,previous,changes,settlements,claims,events=[]){
  clearOperationalLayers();
  addGeoLayer('reference_ru',referenceControl,()=>styles.reference_ru);
  ['control_ru','control_ua','contested','unknown'].forEach(status=>{
    addGeoLayer(status,{type:'FeatureCollection',features:(current.features||[]).filter(f=>f.properties?.status===status)});
  });
  addGeoLayer('previous',previous,()=>styles.previous);
  addGeoLayer('change',changes,f=>({...layerStyle({...f,properties:{...f.properties,layer:'change'}})}));
  const settlementLayer=L.featureGroup((settlements||[]).filter(s=>Number.isFinite(Number(s.lat))&&Number.isFinite(Number(s.lon))).map(s=>
    L.circleMarker([Number(s.lat),Number(s.lon)],{radius:6,color:'#152019',weight:2,fillColor:'#fffdf8',fillOpacity:1}).bindPopup(`<strong>${escapeHtml(s.name)}</strong><br><small>${escapeHtml(statusLabel(s.status))}</small>`)
  ));
  state.layers.settlements=settlementLayer; settlementLayer.addTo(map);
  ['russian','ukrainian'].forEach(side=>{
    const color=side==='russian'?'#bd584c':'#4770a2';
    const markers=(claims||[]).filter(c=>c.side===side&&c.location&&Number.isFinite(Number(c.location.lat))&&Number.isFinite(Number(c.location.lon))).map(c=>
      L.circleMarker([Number(c.location.lat),Number(c.location.lon)],{radius:5,color,fillColor:color,fillOpacity:.25,weight:2,dashArray:'3 3'}).bindPopup(`<strong>Заявление стороны</strong><p>${escapeHtml(c.summary)}</p>`)
    );
    const group=L.featureGroup(markers); state.layers[`claim_${side}`]=group; group.addTo(map);
  });
  const visibleEvents=(events||[]).filter(event=>['confirmed','probable','corrected'].includes(event.verification_status)&&event.location&&Number.isFinite(Number(event.location.lat))&&Number.isFinite(Number(event.location.lon)));
  const eventMarkers=visibleEvents.map((event,index)=>
    L.circleMarker([Number(event.location.lat),Number(event.location.lon)],{
      radius:index===0?9:7,color:event.verification_status==='probable'?'#a96c1d':'#24523e',fillColor:'#b9db57',fillOpacity:.88,weight:3,className:index===0?'latest-event-marker':''
    }).bindPopup(`<div class="map-popup"><strong>${escapeHtml(eventTitle(event))}</strong><p>${escapeHtml(eventSummary(event))}</p><dl><dt>Статус</dt><dd>${escapeHtml(eventStatusLabel(event.verification_status))}</dd><dt>Дата</dt><dd>${escapeHtml(event.event_date)}</dd></dl><div class="record-links">${evidenceLinks(event.evidence_ids)}${event.evidence_ids?.length?' · ':''}${sourceLinks(event.source_ids)}</div><p class="point-warning">${escapeHtml(event.publication_note||'Точка сообщения не является границей контроля.')}</p></div>`)
  );
  state.layers.events=L.featureGroup(eventMarkers);state.layers.events.addTo(map);
  syncLayerButtons();
  const bounds=L.featureGroup(Object.values(state.layers).filter(layer=>layer&&map.hasLayer(layer))).getBounds();
  if(bounds.isValid())map.fitBounds(bounds.pad(.12)); else map.setView([48.7,35.2],6);
}

function syncLayerButtons(){
  document.querySelectorAll('[data-layer]').forEach(button=>{
    const key=button.dataset.layer;
    const visible=state.layers[key]?map.hasLayer(state.layers[key]):state.layerVisibility[key]!==false;
    button.classList.toggle('off',!visible);button.setAttribute('aria-pressed',String(visible));
  });
}

function freshness(status){
  const reference=status.published_at||status.point_feed_published_at;
  if(!reference)return {label:i18n[state.language].fresh_empty,state:'empty'};
  const ageHours=(Date.now()-new Date(reference))/3600000;
  if(ageHours>72)return {label:`${i18n[state.language].fresh_stale} · ${Math.floor(ageHours)} h`,state:'stale'};
  return {label:status.snapshot_date?i18n[state.language].fresh_current:(i18n[state.language].fresh_points||i18n[state.language].fresh_current),state:'current'};
}

function renderStatus(status,settlements,events,claims){
  const currentFreshness=freshness(status);
  const displayDate=status.snapshot_date||status.point_feed_date;
  const displayTime=status.published_at||status.point_feed_published_at;
  $('snapshotDate').textContent=formatDate(displayDate);
  $('mapDate').textContent=formatDate(displayDate);
  $('snapshotTime').textContent=formatTime(displayTime);
  $('snapshotHash').textContent=`${i18n[state.language].version}: ${status.snapshot_sha256?status.snapshot_sha256.slice(0,12):'—'}`;
  $('freshnessLabel').textContent=currentFreshness.label;
  document.querySelector('.live-dot').dataset.state=currentFreshness.state;
  $('settlementCount').textContent=status.new_settlements??settlements.length;
  $('eventCount').textContent=events.filter(e=>['confirmed','probable','corrected'].includes(e.verification_status)).length;
  $('disputedCount').textContent=[...events,...claims].filter(e=>['claim','disputed'].includes(e.verification_status)).length;
  const hasPoints=events.some(event=>['confirmed','probable','corrected'].includes(event.verification_status)&&event.location);
  const hasReference=Boolean(state.data.referenceControl?.features?.length);
  $('mapEmpty').hidden=Boolean(state.data.current?.features?.length)||hasReference||hasPoints;
  $('mapPointNotice').hidden=!hasReference&&!hasPoints;
  $('downloadGeojson').href=state.data.current?.features?.length?'data/current.geojson':hasReference?'data/reference-control.geojson':'data/updates.geojson';
}

function changeCard(feature){
  const p=feature.properties||{};
  return `<button type="button" class="change-item" data-change-id="${escapeHtml(p.id||'')}"><time>${escapeHtml(p.date||'')}</time><h4>${escapeHtml(p.name||'Территориальное изменение')}</h4><p>${escapeHtml(p.summary||'')}</p><div class="change-meta"><span>${formatArea(p.area_km2)}</span><span>confidence ${escapeHtml(p.confidence??'—')}</span></div><span class="open-evidence">Почему изменилось →</span></button>`;
}

function renderChanges(collection,period=state.period){
  const items=collection.features||[];
  const total=items.reduce((sum,f)=>sum+Number(f.properties?.area_km2||0),0);
  const label={day:i18n[state.language].area_day,week:i18n[state.language].area_week,month:i18n[state.language].area_month}[period];
  $('areaPeriodLabel').textContent=label;$('areaDay').textContent=formatArea(total);
  const pointEvents=(state.data.events||[]).filter(event=>event.event_kind==='territorial_update'&&['confirmed','probable','corrected'].includes(event.verification_status));
  $('changeBadge').textContent=items.length||pointEvents.length;
  $('changeSummary').textContent=`${i18n[state.language].total_changes}: ${formatArea(total)}`;
  $('changeList').innerHTML=items.length?items.map(changeCard).join(''):pointEvents.length?pointEvents.map(event=>`<button type="button" class="change-item event-change-item" data-event-id="${escapeHtml(event.id)}"><time>${escapeHtml(event.event_date)}</time><h4>${escapeHtml(eventTitle(event))}</h4><p>${escapeHtml(eventSummary(event))}</p><div class="change-meta"><span>${escapeHtml(eventStatusLabel(event.verification_status))}</span><span>точка</span></div><span class="open-evidence">Открыть на карте →</span></button>`).join(''):`<div class="empty-state">${escapeHtml(i18n[state.language].no_changes)}</div>`;
  state.data.visibleChanges=items;
}

function evidenceMatrix(feature){
  const evidence=(feature.properties?.evidence_ids||[]).map(id=>state.data.evidence.find(item=>item.id===id)).filter(Boolean);
  const hasSide=side=>evidence.some(item=>state.data.sources.find(source=>source.id===item.source_id)?.side===side);
  const cells=[
    ['Заявление российской стороны',hasSide('russian')],['Заявление украинской стороны',hasSide('ukrainian')],
    ['Независимое OSINT-подтверждение',hasSide('independent')],['Спутниковое подтверждение',evidence.some(item=>item.evidence_type==='satellite')]
  ];
  return cells.map(([label,ok])=>`<div class="matrix-cell ${ok?'confirmed':'missing'}"><span>${ok?'✓':'—'}</span>${escapeHtml(label)}</div>`).join('');
}

function openChange(feature){
  const p=feature.properties||{};
  const evidence=(p.evidence_ids||[]).map(id=>state.data.evidence.find(item=>item.id===id)).filter(Boolean);
  const reviews=p.reviews||[];
  $('recordContent').innerHTML=`<p class="section-kicker">EVIDENCE BUNDLE</p><h2>${escapeHtml(p.name||'Территориальное изменение')}</h2><p class="record-lede">${escapeHtml(p.summary||'')}</p><div class="record-stats"><span><b>${formatArea(p.area_km2)}</b>площадь</span><span><b>${Number(p.confidence||0).toFixed(2)}</b>confidence</span><span><b>${escapeHtml(p.date||'—')}</b>дата изменения</span></div><h3>Матрица подтверждения</h3><div class="evidence-matrix">${evidenceMatrix(feature)}</div><h3>Доказательства</h3>${evidence.length?`<div class="evidence-list">${evidence.map(item=>`<article><span>${escapeHtml(item.evidence_type)}</span><p>${escapeHtml(item.verification_note||'Проверочная заметка не опубликована.')}</p><a href="${safeUrl(item.url)}" target="_blank" rel="noopener noreferrer">Открыть первоисточник ↗</a></article>`).join('')}</div>`:'<p class="record-empty">Для этой записи не опубликован evidence bundle. Геометрия не должна была пройти production-валидацию.</p>'}<h3>Ручная проверка</h3>${reviews.length?reviews.map(review=>`<p class="review-note"><b>${escapeHtml(review.reviewer)}</b> · ${escapeHtml(formatTime(review.reviewed_at))}<br>${escapeHtml(review.rationale||'')}</p>`).join(''):'<p class="record-empty">Сведения о проверке отсутствуют.</p>'}`;
  $('recordDialog').showModal();
}

function sourceLinks(ids=[]){
  return ids.map(id=>state.data.sources.find(source=>source.id===id)).filter(Boolean).map(source=>`<a href="${safeUrl(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.name)}</a>`).join(' · ');
}

function evidenceLinks(ids=[]){
  const links=ids.map(id=>state.data.evidence.find(item=>item.id===id)).filter(Boolean).map(item=>`<a href="${safeUrl(item.url)}" target="_blank" rel="noopener noreferrer">Первоисточник</a>`);
  return [...new Set(links)].join(' · ');
}

function renderEvents(events,claims){
  const verified=events.filter(e=>['confirmed','probable','corrected'].includes(e.verification_status));
  const unverified=[...claims,...events.filter(e=>['claim','disputed','withdrawn'].includes(e.verification_status))];
  $('eventBadge').textContent=verified.length;
  $('eventList').innerHTML=verified.length?verified.map(e=>`<article class="event-card" data-event-id="${escapeHtml(e.id)}"><time>${escapeHtml(e.event_date||'')} · ${escapeHtml(eventStatusLabel(e.verification_status))}</time><h3>${escapeHtml(eventTitle(e))}</h3><p>${escapeHtml(eventSummary(e))}</p><div class="record-links">${evidenceLinks(e.evidence_ids)}${e.evidence_ids?.length?' · ':''}${sourceLinks(e.source_ids)}</div></article>`).join(''):`<div class="empty-state">${escapeHtml(i18n[state.language].no_events)}</div>`;
  $('claimList').innerHTML=unverified.length?unverified.map(e=>`<article class="claim-card"><span class="side">${escapeHtml(e.side_label||({russian:i18n[state.language].filter_ru,ukrainian:i18n[state.language].filter_ua})[e.side]||'Source')}</span><p>${escapeHtml(e.summary)}</p><div class="record-links">${sourceLinks(e.source_ids)}</div></article>`).join(''):`<div class="empty-state">${escapeHtml(i18n[state.language].no_claims)}</div>`;
}

function healthFor(id){return state.data.sourceHealth?.results?.find(item=>item.source_id===id);}
function renderSources(filter=state.sourceFilter){
  const sources=state.data.sources.filter(source=>filter==='all'||source.side===filter);
  $('sourceGrid').innerHTML=sources.map(source=>{
    const health=healthFor(source.id);const healthState=health?.state||source.health;const healthLabel=health?`${health.state} · ${formatTime(health.checked_at)}`:source.health_label;
    return `<article class="source-card"><header><div><h3>${escapeHtml(source.name)}</h3><p>${escapeHtml(source.role)}</p></div><i class="health ${escapeHtml(healthState)}" aria-label="${escapeHtml(healthLabel)}"></i></header><div class="source-tags"><span>${escapeHtml(source.side)}</span><span>${escapeHtml(source.license_status)}</span></div><p>${escapeHtml(source.usage_note)}</p><a href="${safeUrl(source.url)}" target="_blank" rel="noopener noreferrer">Перейти к источнику ↗</a></article>`;
  }).join('')||`<div class="empty-state">${escapeHtml(i18n[state.language].no_sources)}</div>`;
}

function renderArchive(manifest){
  const select=$('snapshotSelect');
  select.innerHTML=`<option value="current">${escapeHtml(i18n[state.language].current_snapshot)}</option>`+manifest.map(item=>`<option value="${escapeHtml(item.date)}">${escapeHtml(formatDate(item.date))}</option>`).join('');
  $('archiveMeta').textContent=manifest.length?`${manifest.length} snapshots` : i18n[state.language].archive_empty;
  const audit=state.data.audit||[];
  $('auditList').innerHTML=audit.length?[...audit].reverse().slice(0,20).map(item=>`<p><b>${escapeHtml(item.snapshot_date||'—')}</b> ${escapeHtml(item.action||'update')}<br><span>SHA-256 ${escapeHtml((item.sha256||'').slice(0,12))} · ${escapeHtml(formatTime(item.published_at))}</span></p>`).join(''):'<p>Записей пока нет.</p>';
}

function searchSettlements(query){
  const normalized=query.trim().toLocaleLowerCase();
  if(normalized.length<2)return [];
  return state.data.settlementIndex.filter(item=>{
    const names=[item.name,item.name_ru,item.name_uk,item.name_en,...(item.aliases||[])].filter(Boolean).map(value=>String(value).toLocaleLowerCase());
    return names.some(name=>name.includes(normalized));
  }).slice(0,8);
}

function renderSearch(query){
  const results=searchSettlements(query);const container=$('searchResults');
  if(query.trim().length<2){container.hidden=true;container.innerHTML='';return;}
  container.hidden=false;
  container.innerHTML=results.length?results.map(item=>`<button type="button" data-settlement-id="${escapeHtml(item.id)}"><span><b>${escapeHtml(settlementName(item))}</b><small>${escapeHtml(item.admin1||'')}</small></span><em>${escapeHtml(statusLabel(item.status))}</em></button>`).join(''):`<div class="search-empty">${escapeHtml(i18n[state.language].no_search)}</div>`;
}

function openSettlement(item){
  const relatedClaims=state.data.claims.filter(claim=>claim.settlement_id===item.id);
  const relatedEvents=state.data.events.filter(event=>event.settlement_id===item.id);
  $('recordContent').innerHTML=`<p class="section-kicker">SETTLEMENT CARD</p><h2>${escapeHtml(settlementName(item))}</h2><p class="name-variants">${[item.name_uk,item.name_ru,item.name_en].filter(Boolean).map(escapeHtml).join(' · ')}</p><div class="record-stats"><span><b>${escapeHtml(statusLabel(item.status))}</b>текущий статус</span><span><b>${escapeHtml(item.admin1||'—')}</b>область</span><span><b>${Number(item.lat).toFixed(4)}, ${Number(item.lon).toFixed(4)}</b>координаты населённого пункта</span></div><h3>Заявления сторон</h3>${relatedClaims.length?relatedClaims.map(claim=>`<p class="review-note">${escapeHtml(claim.side_label||claim.side)}: ${escapeHtml(claim.summary)}</p>`).join(''):'<p class="record-empty">Связанных заявлений пока нет.</p>'}<h3>Подтверждённые события</h3>${relatedEvents.length?relatedEvents.map(event=>`<p class="review-note"><b>${escapeHtml(event.event_date)}</b> ${escapeHtml(event.summary)}</p>`).join(''):'<p class="record-empty">Связанных событий пока нет.</p>'}`;
  $('recordDialog').showModal();
  if(Number.isFinite(Number(item.lat))&&Number.isFinite(Number(item.lon)))map.setView([Number(item.lat),Number(item.lon)],11);
  $('searchResults').hidden=true;
}

function setLanguage(language){
  if(!i18n[language])return;state.language=language;document.documentElement.lang=language;
  document.querySelectorAll('[data-i18n]').forEach(element=>{const value=i18n[language][element.dataset.i18n];if(value)element.textContent=value;});
  document.querySelectorAll('[data-i18n-html]').forEach(element=>{const value=i18n[language][element.dataset.i18nHtml];if(value)element.innerHTML=value;});
  $('settlementSearch').placeholder=i18n[language].search_placeholder;
  $('bandwidthButton').textContent=state.lowBandwidth?i18n[language].bandwidth_on:i18n[language].bandwidth;
  try{localStorage.setItem('warmap-language',language)}catch{}
  if(state.data.status){renderStatus(state.data.status,state.data.settlements||[],state.data.events||[],state.data.claims||[]);renderChanges({type:'FeatureCollection',features:state.data.visibleChanges||state.data.changes?.features||[]},state.period);renderEvents(state.data.events||[],state.data.claims||[]);renderArchive(state.data.manifest||[]);}
  renderSearch($('settlementSearch').value);renderSources();
}

function setLowBandwidth(enabled){
  state.lowBandwidth=enabled;document.body.classList.toggle('low-bandwidth',enabled);
  if(enabled&&map.hasLayer(baseLayer))map.removeLayer(baseLayer);else if(!enabled&&!map.hasLayer(baseLayer))baseLayer.addTo(map);
  ['events','claim_russian','claim_ukrainian'].forEach(key=>{const layer=state.layers[key];if(!layer)return;if(enabled&&map.hasLayer(layer))map.removeLayer(layer);else if(!enabled&&!map.hasLayer(layer))layer.addTo(map);});
  $('bandwidthButton').setAttribute('aria-pressed',String(enabled));
  $('bandwidthButton').textContent=enabled?i18n[state.language].bandwidth_on:i18n[state.language].bandwidth;
  try{localStorage.setItem('warmap-low-bandwidth',String(enabled))}catch{}
  announce(enabled?'Включён режим экономии трафика':'Обычный режим карты включён');
}

async function archivedChanges(period){
  const days={day:1,week:7,month:30}[period];
  const anchor=state.data.status.snapshot_date?new Date(`${state.data.status.snapshot_date}T12:00:00Z`):new Date();
  const eligible=state.data.manifest.filter(item=>(anchor-new Date(`${item.date}T12:00:00Z`))/86400000<days);
  const collections=await Promise.all(eligible.map(item=>getJson(`data/snapshots/${item.date}/changes.geojson`,emptyGeojson(),true)));
  if(!eligible.length)collections.push(state.data.changes);
  const byId=new Map();collections.flatMap(collection=>collection.features||[]).forEach(feature=>byId.set(feature.properties?.id||JSON.stringify(feature.geometry),feature));
  return {type:'FeatureCollection',features:[...byId.values()]};
}

async function selectPeriod(period){
  state.period=period;
  document.querySelectorAll('[data-period]').forEach(button=>{const active=button.dataset.period===period;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
  const collection=await archivedChanges(period);
  if(state.layers.change&&map.hasLayer(state.layers.change))map.removeLayer(state.layers.change);
  state.layers.change=L.geoJSON(collection,{style:f=>styles.change,onEachFeature:popup}).addTo(map);
  state.layerVisibility.change=true;syncLayerButtons();renderChanges(collection,period);
  announce(`Показаны изменения за ${period==='day'?'24 часа':period==='week'?'7 дней':'30 дней'}`);
}

async function selectSnapshot(value){
  state.archive=value;const base=value==='current'?'data':`data/snapshots/${value}`;
  const [current,changes,settlements,events,status]=await Promise.all([
    getJson(`${base}/current.geojson`,emptyGeojson()),getJson(`${base}/changes.geojson`,emptyGeojson()),getJson(`${base}/settlements.json`,[]),getJson(`${base}/events.json`,[]),
    value==='current'?Promise.resolve(state.data.status):getJson(`${base}/status.json`,{snapshot_date:value})
  ]);
  const previous=value==='current'?state.data.previous:emptyGeojson();
  state.data.current=current;state.data.changes=changes;
  renderMap(current,value==='current'?state.data.referenceControl:emptyGeojson(),previous,changes,settlements,state.data.claims,events);renderStatus(status,settlements,events,state.data.claims);renderChanges(changes,'day');
  if(state.lowBandwidth)setLowBandwidth(true);
  if(value!=='current')$('downloadGeojson').href=`${base}/current.geojson`;
  const record=state.data.manifest.find(item=>item.date===value);
  $('archiveMeta').textContent=record?`${record.change_count} changes · ${formatArea(record.area_change_km2)} · SHA-256 ${record.sha256.slice(0,12)}…`:i18n[state.language].archive_current;
  announce(`Открыт снимок ${value==='current'?'текущий':formatDate(value)}`);
}

async function init(){
  const [status,current,referenceControl,previous,changes,updates,settlements,events,claims,evidence,sources,settlementIndex,sourceHealth,manifest,audit]=await Promise.all([
    getJson(paths.status,{}),getJson(paths.current,emptyGeojson()),getJson(paths.referenceControl,emptyGeojson()),getJson(paths.previous,emptyGeojson()),getJson(paths.changes,emptyGeojson()),
    getJson(paths.updates,emptyGeojson()),getJson(paths.settlements,[]),getJson(paths.events,[]),getJson(paths.claims,[]),getJson(paths.evidence,[]),getJson(paths.sources,[]),
    getJson(paths.settlementIndex,[]),getJson(paths.sourceHealth,{checked_at:null,results:[]}),getJson(paths.manifest,[]),getJson(paths.audit,[])
  ]);
  state.data={status,current,referenceControl,previous,changes,updates,settlements,events,claims,evidence,sources,settlementIndex,sourceHealth,manifest,audit};
  renderMap(current,referenceControl,previous,changes,settlements,claims,events);renderStatus(status,settlements,events,claims);renderChanges(changes);renderEvents(events,claims);renderSources();renderArchive(manifest);
  let savedLanguage='ru',savedBandwidth=false;try{savedLanguage=localStorage.getItem('warmap-language')||'ru';savedBandwidth=localStorage.getItem('warmap-low-bandwidth')==='true'}catch{}
  $('languageSelect').value=i18n[savedLanguage]?savedLanguage:'ru';setLanguage($('languageSelect').value);setLowBandwidth(savedBandwidth);
  announce('Карта и реестр источников загружены');
}

document.querySelectorAll('[data-period]').forEach(button=>button.addEventListener('click',()=>selectPeriod(button.dataset.period)));
document.querySelectorAll('[data-layer]').forEach(button=>button.addEventListener('click',()=>{
  const key=button.dataset.layer;const layer=state.layers[key];if(!layer)return;
  if(map.hasLayer(layer)){map.removeLayer(layer);state.layerVisibility[key]=false}else{layer.addTo(map);state.layerVisibility[key]=true}
  syncLayerButtons();announce(`${button.textContent.trim()}: ${map.hasLayer(layer)?'показан':'скрыт'}`);
}));
document.querySelectorAll('[data-source-filter]').forEach(button=>button.addEventListener('click',()=>{
  state.sourceFilter=button.dataset.sourceFilter;document.querySelectorAll('[data-source-filter]').forEach(item=>{const active=item===button;item.classList.toggle('active',active);item.setAttribute('aria-pressed',String(active));});renderSources();
}));
$('snapshotSelect').addEventListener('change',event=>selectSnapshot(event.target.value));
$('languageSelect').addEventListener('change',event=>setLanguage(event.target.value));
$('bandwidthButton').addEventListener('click',()=>setLowBandwidth(!state.lowBandwidth));
$('settlementSearch').addEventListener('input',event=>renderSearch(event.target.value));
$('searchResults').addEventListener('click',event=>{
  const button=event.target.closest('[data-settlement-id]');if(!button)return;
  const item=state.data.settlementIndex.find(settlement=>settlement.id===button.dataset.settlementId);if(item)openSettlement(item);
});
$('changeList').addEventListener('click',event=>{
  const button=event.target.closest('[data-change-id]');if(!button)return;
  const feature=(state.data.visibleChanges||[]).find(item=>item.properties?.id===button.dataset.changeId);if(feature)openChange(feature);
});
$('changeList').addEventListener('click',event=>{
  const button=event.target.closest('[data-event-id]');if(!button)return;
  const item=state.data.events.find(candidate=>candidate.id===button.dataset.eventId);if(item?.location){map.setView([Number(item.location.lat),Number(item.location.lon)],11);state.layers.events?.eachLayer(layer=>{const latlng=layer.getLatLng?.();if(latlng&&latlng.lat===Number(item.location.lat)&&latlng.lng===Number(item.location.lon))layer.openPopup();});}
});
$('eventList').addEventListener('click',event=>{
  const card=event.target.closest('[data-event-id]');if(!card||event.target.closest('a'))return;
  const item=state.data.events.find(candidate=>candidate.id===card.dataset.eventId);if(item?.location){document.getElementById('map-section').scrollIntoView({behavior:'smooth'});map.setView([Number(item.location.lat),Number(item.location.lon)],11);}
});
document.addEventListener('keydown',event=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();$('settlementSearch').focus();}});
$('aboutButton').addEventListener('click',()=>$('aboutDialog').showModal());
$('closeAbout').addEventListener('click',()=>$('aboutDialog').close());
$('closeRecord').addEventListener('click',()=>$('recordDialog').close());
init();
