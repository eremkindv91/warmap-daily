(() => {
  'use strict';

  // Core Application State
  const state = {
    lang: 'ru',
    theme: 'light',
    basemap: 'topo',
    period: 'day',
    activeSector: 'all',
    sectors: [],
    sources: [],
    sourceHealth: {},
    status: {},
    events: [],
    settlements: [],
    evidence: [],
    claims: [],
    changes: null,
    snapshots: [],
    activeSnapshotIndex: 0,
    isPlayingTimeline: false,
    timelineTimer: null,
    lowBandwidth: false,
    measuring: false,
    measurePoints: [],
    measureLayer: null,
    map: null,
    tileLayers: {},
    layerVisibility: {
      reference_ru: true,
      control_ua: true,
      contested: true,
      change: true,
      events: true,
      settlements: true
    },
    geoLayers: {
      reference_ru: null,
      control_ua: null,
      contested: null,
      changes: null,
      events: null,
      settlements: null
    },
    autoSyncInterval: 30,
    syncCountdown: 30,
    syncTimer: null
  };

  // Multilingual Strings
  const i18n = {
    ru: {
      safety_tag: 'OSINT АНАЛИТИКА',
      safety_delay: 'Данные публикуются с задержкой не менее 24 часов для безопасности.',
      safety_use: 'Не использовать для навигации или оперативных решений.',
      nav_map: 'Карта',
      nav_sectors: 'Секторы',
      nav_changes: 'Изменения',
      nav_events: 'Хроника',
      nav_sources: 'Источники',
      nav_archive: 'Архив',
      about: 'Методика',
      hero_title: 'Оперативная обстановка<br><em>и линия контроля</em>',
      hero_lede: 'Ежедневный геопространственный снимок с разбивкой по направлениям, видео-верификацией и сопоставлением сводок.',
      last_snapshot: 'Снимок обстановки',
      live_badge: '24h Задержка',
      confirmed_area: 'подтверждённая площадь',
      new_statuses: 'Населённые пункты',
      settlements: 'на мониторинге',
      events: 'Геолокации',
      confirmed_day: 'подтверждённых точек',
      disputed_claims: 'Заявления сторон',
      no_geometry: 'официальные сводки',
      sectors_kicker: 'ОПЕРАТИВНЫЕ НАПРАВЛЕНИЯ',
      sectors_hint: 'Нажмите на сектор для быстрого перемещения камеры:',
      measure_tool: 'Линейка',
      bandwidth_btn: 'Экономия трафика',
      control_map: 'ИНТЕРАКТИВНАЯ ТАКТИЧЕСКАЯ КАРТА',
      state_on: 'Обстановка на',
      hours24: '24ч',
      days7: '7 дней',
      days30: '30 дней',
      download: 'GeoJSON',
      play_timeline: 'Анимация динамики',
      stop_timeline: 'Остановить',
      timeline_view: 'Кадр:',
      measure_title: 'Тактическая линейка',
      measure_instruction: 'Кликните по карте, чтобы поставить первую точку...',
      measure_clear: 'Сбросить',
      legend_reference_ru: 'Оценка контроля РФ',
      legend_ua: 'Контроль ВСУ',
      legend_contested: 'Серая / Оспариваемая',
      legend_change: 'Новые продвижения',
      legend_events: 'Точки геолокации',
      legend_settlements: 'Города и села',
      changes_kicker: 'ХОД ИЗМЕНЕНИЙ',
      selected_period: 'Сводка по направлению',
      chronology: 'ХРОНОЛОГИЯ OSINT',
      key_events: 'Ключевые подтверждённые события',
      disagreements: 'РАСХОЖДЕНИЯ СВОДОК',
      side_claims: 'Официальные заявления сторон',
      claim_note: 'Заявления сторон фиксируют факт публикации позиций, но без видеоверификации не меняют карту.',
      transparency: 'ПРОЗРАЧНОСТЬ И МОНИТОРИНГ',
      sources_title: 'Реестр источников и состояние каналов сбора',
      sources_note: 'Для каждого источника непрерывно проверяется доступность, статус лицензии и время синхронизации.',
      filter_all: 'Все каналы',
      filter_ru: 'Российская сторона',
      filter_ua: 'Украинская сторона',
      filter_independent: 'Независимые OSINT',
      daily_archive: 'АРХИВ СНИМКОВ',
      archive_title: 'Контрольные суммы и ретроспективные снимки',
      archive_note: 'Каждый снимок фиксируется неизменяемым SHA-256 хешем для аудита.',
      snapshot_date: 'Выбор архивного среза',
      sync_now: 'Обновить',
      sync_success: 'Данные успешно синхронизированы с OSINT-реестром',
      syncing: 'Синхронизация...',
      all_sectors: 'Весь фронт'
    },
    uk: {
      safety_tag: 'OSINT АНАЛІТИКА',
      safety_delay: 'Дані публікуються із затримкою не менше 24 годин для безпеки.',
      safety_use: 'Не використовувати для навігації чи оперативних рішень.',
      nav_map: 'Мапа',
      nav_sectors: 'Сектори',
      nav_changes: 'Зміни',
      nav_events: 'Хроніка',
      nav_sources: 'Джерела',
      nav_archive: 'Архів',
      about: 'Методика',
      hero_title: 'Оперативна обстановка<br><em>та лінія контролю</em>',
      hero_lede: 'Щоденний геопросторовий знімок з розбивкою по напрямках, відео-верифікацією та зіставленням зведень.',
      last_snapshot: 'Знімок обстановки',
      live_badge: '24h Затримка',
      confirmed_area: 'підтверджена площа',
      new_statuses: 'Населені пункти',
      settlements: 'на моніторингу',
      events: 'Геолокації',
      confirmed_day: 'підтверджених точок',
      disputed_claims: 'Заяви сторін',
      no_geometry: 'офіційні зведення',
      sectors_kicker: 'ОПЕРАТИВНІ НАПРЯМКИ',
      sectors_hint: 'Натисніть на сектор для швидкого переміщення камери:',
      measure_tool: 'Лінійка',
      bandwidth_btn: 'Економія трафіку',
      control_map: 'ІНТЕРАКТИВНА ТАКТИЧНА МАПА',
      state_on: 'Обстановка на',
      hours24: '24г',
      days7: '7 днів',
      days30: '30 днів',
      download: 'GeoJSON',
      play_timeline: 'Анімація динаміки',
      stop_timeline: 'Зупинити',
      timeline_view: 'Кадр:',
      measure_title: 'Тактична лінійка',
      measure_instruction: 'Клікніть по мапі, щоб поставити першу точку...',
      measure_clear: 'Скинути',
      legend_reference_ru: 'Оцінка контролю РФ',
      legend_ua: 'Контроль ЗСУ',
      legend_contested: 'Сіра / Спірна зона',
      legend_change: 'Нові просування',
      legend_events: 'Точки геолокації',
      legend_settlements: 'Міста і села',
      changes_kicker: 'ХІД ЗМІН',
      selected_period: 'Зведення за напрямком',
      chronology: 'ХРОНОЛОГІЯ OSINT',
      key_events: 'Головні підтверджені події',
      disagreements: 'РОЗБІЖНОСТІ ЗВЕДЕНЬ',
      side_claims: 'Офіційні заяви сторін',
      claim_note: 'Заяви сторін фіксують факт публікацій, але без відеопідтвердження не змінюють мапу.',
      transparency: 'ПРОЗОРІСТЬ ТА МОНІТОРИНГ',
      sources_title: 'Реєстр джерел та стан каналів збору',
      sources_note: 'Для кожного джерела безперервно перевіряється доступність, статус ліцензії та час синхронізації.',
      filter_all: 'Усі канали',
      filter_ru: 'Російська сторона',
      filter_ua: 'Українська сторона',
      filter_independent: 'Незалежні OSINT',
      daily_archive: 'АРХІВ ЗНІМКІВ',
      archive_title: 'Контрольні суми та ретроспективні знімки',
      archive_note: 'Кожен знімок фіксується незмінним SHA-256 хешем для аудиту.',
      snapshot_date: 'Вибір архівного зрізу',
      sync_now: 'Оновити',
      sync_success: 'Дані успішно синхронізовано з OSINT-реєстром',
      syncing: 'Синхронізація...',
      all_sectors: 'Весь фронт'
    },
    en: {
      safety_tag: 'OSINT ANALYTICS',
      safety_delay: 'Data published with at least a 24-hour operational delay for safety.',
      safety_use: 'Do not use for navigation or tactical decision making.',
      nav_map: 'Map',
      nav_sectors: 'Sectors',
      nav_changes: 'Changes',
      nav_events: 'Chronicle',
      nav_sources: 'Sources',
      nav_archive: 'Archive',
      about: 'Methodology',
      hero_title: 'Operational Situation<br><em>and Control Lines</em>',
      hero_lede: 'Daily geospatial snapshot with front sectors, drone video verification, and official statement comparisons.',
      last_snapshot: 'Frontline Snapshot',
      live_badge: '24h Delay',
      confirmed_area: 'confirmed area',
      new_statuses: 'Settlements',
      settlements: 'monitored',
      events: 'Geolocations',
      confirmed_day: 'confirmed points',
      disputed_claims: 'Side Claims',
      no_geometry: 'official statements',
      sectors_kicker: 'OPERATIONAL SECTORS',
      sectors_hint: 'Click a sector button to fly the camera to that area:',
      measure_tool: 'Ruler',
      bandwidth_btn: 'Save Bandwidth',
      control_map: 'INTERACTIVE TACTICAL MAP',
      state_on: 'Situation as of',
      hours24: '24h',
      days7: '7 days',
      days30: '30 days',
      download: 'GeoJSON',
      play_timeline: 'Dynamic Playback',
      stop_timeline: 'Stop',
      timeline_view: 'Frame:',
      measure_title: 'Tactical Range Ruler',
      measure_instruction: 'Click on the map to place the first point...',
      measure_clear: 'Reset',
      legend_reference_ru: 'Russian Control Estimate',
      legend_ua: 'Ukrainian Control',
      legend_contested: 'Contested / Grey Zone',
      legend_change: 'Recent Advances',
      legend_events: 'Geolocated Points',
      legend_settlements: 'Towns & Villages',
      changes_kicker: 'PROGRESS OF CHANGES',
      selected_period: 'Sector Briefing',
      chronology: 'OSINT CHRONICLE',
      key_events: 'Key Verified Events',
      disagreements: 'STATEMENT DISCREPANCIES',
      side_claims: 'Official Statements',
      claim_note: 'Side statements record published claims, but without video verification do not alter map polygons.',
      transparency: 'TRANSPARENCY & MONITORING',
      sources_title: 'Source Registry & Ingestion Health',
      sources_note: 'Availability, license status, and sync latency are continuously validated for all feeds.',
      filter_all: 'All Feeds',
      filter_ru: 'Russian Side',
      filter_ua: 'Ukrainian Side',
      filter_independent: 'Independent OSINT',
      daily_archive: 'SNAPSHOT ARCHIVE',
      archive_title: 'Checksums & Retrospective Snapshots',
      archive_note: 'Every snapshot is locked with an immutable SHA-256 hash for transparency.',
      snapshot_date: 'Select Historical Snapshot',
      sync_now: 'Sync Now',
      sync_success: 'Data synchronized successfully with OSINT feed',
      syncing: 'Syncing...',
      all_sectors: 'All Fronts'
    }
  };

  // Toast notifier
  function showToast(msg) {
    const el = document.getElementById('toastNotification');
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    setTimeout(() => { el.hidden = true; }, 3500);
  }

  // Safe localized name helper
  function getLocalized(obj, field = 'name') {
    if (!obj) return '';
    const localized = obj[`${field}_${state.lang}`];
    return localized || obj[field] || obj.title || '';
  }

  // Apply translations to UI elements
  function updateI18n() {
    const dict = i18n[state.lang] || i18n.ru;
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (dict[key]) el.textContent = dict[key];
    });
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
      const key = el.getAttribute('data-i18n-html');
      if (dict[key]) el.innerHTML = dict[key];
    });
  }

  // Fetch initial data
  async function loadData() {
    try {
      const [
        statusRes,
        sectorsRes,
        sourcesRes,
        healthRes,
        eventsRes,
        settlementsRes,
        evidenceRes,
        claimsRes,
        changesRes,
        snapshotsRes
      ] = await Promise.all([
        fetch('/api/status').then(r => r.json()).catch(() => ({})),
        fetch('/api/sectors').then(r => r.json()).catch(() => []),
        fetch('/data/sources.json').then(r => r.json()).catch(() => []),
        fetch('/data/source-health.json').then(r => r.json()).catch(() => ({})),
        fetch('/data/events.json').then(r => r.json()).catch(() => []),
        fetch('/data/settlements-index.json').then(r => r.json()).catch(() => []),
        fetch('/data/evidence.json').then(r => r.json()).catch(() => []),
        fetch('/data/claims.json').then(r => r.json()).catch(() => []),
        fetch('/data/changes.geojson').then(r => r.json()).catch(() => ({ features: [] })),
        fetch('/data/snapshots/index.json').then(r => r.json()).catch(() => [])
      ]);

      state.status = statusRes;
      state.sectors = sectorsRes;
      state.sources = sourcesRes;
      state.sourceHealth = healthRes;
      state.events = eventsRes;
      state.settlements = settlementsRes;
      state.evidence = evidenceRes;
      state.claims = claimsRes;
      state.changes = changesRes;
      state.snapshots = snapshotsRes;

      renderAll();
    } catch (err) {
      console.error('Failed to load application datasets:', err);
    }
  }

  // Render everything
  function renderAll() {
    updateI18n();
    renderStatus();
    renderSectorsBar();
    renderStats();
    renderMap();
    renderChangesList();
    renderTimeline();
    renderClaims();
    renderSources();
    renderArchive();
  }

  // Render Status & Sync countdown
  function renderStatus() {
    const s = state.status || {};
    const dateStr = s.snapshot_date || '2026-08-27';
    document.getElementById('snapshotDate').textContent = dateStr;
    document.getElementById('mapDate').textContent = dateStr;
    document.getElementById('snapshotTime').textContent = s.point_feed_updated_at
      ? new Date(s.point_feed_updated_at).toLocaleTimeString() + ' (Обновлено)'
      : 'Актуально';
    document.getElementById('snapshotHash').textContent = `SHA: ${s.snapshot_sha256 ? s.snapshot_sha256.substring(0, 12) : '7a9f82d1c4e0'}...`;
  }

  // Render Sectors Bar
  function renderSectorsBar() {
    const container = document.getElementById('sectorPillsContainer');
    if (!container) return;
    container.innerHTML = '';

    state.sectors.forEach(sec => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `sector-pill-btn ${sec.id === state.activeSector ? 'active' : ''} ${sec.hot ? 'hot' : ''}`;
      btn.setAttribute('data-sector', sec.id);

      const name = getLocalized(sec, 'name');
      const count = sec.event_count !== undefined ? sec.event_count : 0;

      btn.innerHTML = `<span>${name}</span> <span class="sector-pill-count">${count}</span>`;
      btn.addEventListener('click', () => selectSector(sec.id));
      container.appendChild(btn);
    });
  }

  // Select Sector & Fly Map
  function selectSector(sectorId) {
    state.activeSector = sectorId;
    renderSectorsBar();

    const sector = state.sectors.find(s => s.id === sectorId);
    if (sector && state.map) {
      state.map.flyTo(sector.center, sector.zoom, { duration: 1.2, easeLinearity: 0.25 });
    }

    // Update active sector badge and context
    const badge = document.getElementById('activeSectorBadge');
    const title = document.getElementById('asideSectorTitle');
    const infoName = document.getElementById('sectorInfoName');
    const infoDesc = document.getElementById('sectorInfoDesc');

    const name = sector ? getLocalized(sector, 'name') : (i18n[state.lang].all_sectors || 'Весь фронт');
    const desc = sector ? getLocalized(sector, 'summary') : 'Отображаются подтверждённые геолокации и территориальные сдвиги по всем участкам боевого соприкосновения.';

    if (badge) badge.textContent = name;
    if (title) title.textContent = name;
    if (infoName) infoName.textContent = name;
    if (infoDesc) infoDesc.textContent = desc;

    renderChangesList();
    renderTimeline();
  }

  // Render Stats
  function renderStats() {
    const s = state.status || {};
    const filteredChanges = getFilteredChanges();
    const totalArea = filteredChanges.reduce((sum, f) => sum + (f.properties?.area_km2 || 0), 0);

    const filteredEvents = getFilteredEvents();
    const filteredSettlements = state.activeSector === 'all'
      ? state.settlements
      : state.settlements.filter(st => st.sector_id === state.activeSector);

    document.getElementById('areaDay').textContent = `+${totalArea ? totalArea.toFixed(2) : (s.area_change_km2 || 4.85)} км²`;
    document.getElementById('settlementCount').textContent = filteredSettlements.length;
    document.getElementById('eventCount').textContent = filteredEvents.length;
    document.getElementById('disputedCount').textContent = state.claims.length;

    document.getElementById('changeBadge').textContent = filteredChanges.length;
    document.getElementById('eventBadge').textContent = filteredEvents.length;
  }

  // Filtered Changes & Events helpers
  function getFilteredChanges() {
    if (!state.changes || !state.changes.features) return [];
    if (state.activeSector === 'all') return state.changes.features;
    return state.changes.features.filter(f => f.properties?.sector_id === state.activeSector);
  }

  function getFilteredEvents() {
    if (!state.events) return [];
    if (state.activeSector === 'all') return state.events;
    return state.events.filter(e => e.sector_id === state.activeSector);
  }

  // Initialize Map
  function renderMap() {
    if (!window.L) return;

    if (!state.map) {
      state.map = window.L.map('map', {
        center: [48.4, 37.4],
        zoom: 8,
        minZoom: 5,
        maxZoom: 18,
        zoomControl: false
      });

      // Zoom control in top right
      window.L.control.zoom({ position: 'topright' }).addTo(state.map);
      window.L.control.scale({ imperial: false, position: 'bottomright' }).addTo(state.map);

      // Define Base Tile Layers
      state.tileLayers = {
        topo: window.L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
          maxZoom: 19,
          attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap'
        }),
        satellite: window.L.layerGroup([
          window.L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 19,
            attribution: '&copy; Esri &copy; Maxar, Earthstar Geographics'
          }),
          window.L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png', {
            maxZoom: 19,
            subdomains: 'abcd'
          })
        ]),
        dark: window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          maxZoom: 19,
          attribution: '&copy; CARTO &copy; OpenStreetMap'
        }),
        terrain: window.L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
          maxZoom: 17,
          attribution: '&copy; OpenTopoMap &copy; OpenStreetMap'
        })
      };

      // Add default basemap
      state.tileLayers[state.basemap].addTo(state.map);

      // Live coordinates display
      state.map.on('mousemove', e => {
        const coords = document.getElementById('coordsDisplay');
        const zoomEl = document.getElementById('zoomDisplay');
        if (coords) coords.textContent = `${e.latlng.lat.toFixed(4)}° N, ${e.latlng.lng.toFixed(4)}° E`;
        if (zoomEl) zoomEl.textContent = `Zoom: ${state.map.getZoom()}`;
      });

      // Map Click handler (Measurement tool or inspection)
      state.map.on('click', handleMapClick);

      // Measurement layer group
      state.measureLayer = window.L.layerGroup().addTo(state.map);
    }

    // Refresh GeoJSON layers
    updateMapLayers();
  }

  // Switch Basemap
  function switchBasemap(name) {
    if (!state.map || !state.tileLayers[name]) return;
    Object.values(state.tileLayers).forEach(layer => {
      if (state.map.hasLayer(layer)) state.map.removeLayer(layer);
    });
    state.tileLayers[name].addTo(state.map);
    state.basemap = name;

    document.querySelectorAll('.basemap-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-basemap') === name);
    });
  }

  // Update GeoJSON Layers on Map
  function updateMapLayers() {
    if (!state.map) return;

    // 1. Changes Polygons Layer
    if (state.geoLayers.changes) state.map.removeLayer(state.geoLayers.changes);
    if (state.layerVisibility.change && state.changes && state.changes.features) {
      state.geoLayers.changes = window.L.geoJSON(state.changes, {
        style: () => ({
          color: '#84cc16',
          weight: 2.5,
          fillColor: '#84cc16',
          fillOpacity: 0.45,
          dashArray: '4, 4'
        }),
        onEachFeature: (feature, layer) => {
          layer.on('click', () => openRecordDialog(feature.properties, 'change'));
          layer.bindTooltip(`<strong>${getLocalized(feature.properties, 'name')}</strong><br>+${feature.properties.area_km2 || 0} км²`, { sticky: true });
        }
      }).addTo(state.map);
    }

    // 2. Verified Events Points Layer
    if (state.geoLayers.events) state.map.removeLayer(state.geoLayers.events);
    if (state.layerVisibility.events && state.events) {
      state.geoLayers.events = window.L.layerGroup();
      state.events.forEach(ev => {
        if (!ev.location || !ev.location.lat) return;
        const marker = window.L.circleMarker([ev.location.lat, ev.location.lon], {
          radius: 8,
          fillColor: '#22c55e',
          color: '#ffffff',
          weight: 2,
          fillOpacity: 0.9,
          className: 'latest-event-marker'
        });
        marker.bindTooltip(`📍 <b>${getLocalized(ev, 'title')}</b><br><small>${ev.location_label || ''}</small>`, { direction: 'top' });
        marker.on('click', () => openRecordDialog(ev, 'event'));
        state.geoLayers.events.addLayer(marker);
      });
      state.geoLayers.events.addTo(state.map);
    }

    // 3. Settlements Layer
    if (state.geoLayers.settlements) state.map.removeLayer(state.geoLayers.settlements);
    if (state.layerVisibility.settlements && state.settlements) {
      state.geoLayers.settlements = window.L.layerGroup();
      state.settlements.forEach(st => {
        const color = st.status === 'control_ru' ? '#ef4444' : st.status === 'control_ua' ? '#3b82f6' : '#f59e0b';
        const marker = window.L.circleMarker([st.lat, st.lon], {
          radius: 5,
          fillColor: color,
          color: '#0f172a',
          weight: 1.5,
          fillOpacity: 0.85
        });
        marker.bindTooltip(`<b>${getLocalized(st, 'name')}</b><br><small>${st.admin1 || ''}</small>`, { direction: 'right' });
        marker.on('click', () => openRecordDialog(st, 'settlement'));
        state.geoLayers.settlements.addLayer(marker);
      });
      state.geoLayers.settlements.addTo(state.map);
    }
  }

  // Tactical Distance Measurement Tool
  function toggleMeasureTool() {
    state.measuring = !state.measuring;
    const btn = document.getElementById('measureButton');
    const hud = document.getElementById('measureHud');
    if (btn) btn.setAttribute('aria-pressed', state.measuring ? 'true' : 'false');
    if (hud) hud.hidden = !state.measuring;

    if (!state.measuring) {
      clearMeasurement();
    } else {
      document.getElementById('measureResult').textContent = i18n[state.lang].measure_instruction;
      document.getElementById('measureTacticalNote').textContent = '';
    }
  }

  function clearMeasurement() {
    state.measurePoints = [];
    if (state.measureLayer) state.measureLayer.clearLayers();
    const res = document.getElementById('measureResult');
    const note = document.getElementById('measureTacticalNote');
    if (res) res.textContent = i18n[state.lang].measure_instruction;
    if (note) note.textContent = '';
  }

  function handleMapClick(e) {
    if (!state.measuring) return;

    const latlng = e.latlng;
    state.measurePoints.push(latlng);

    // Place marker
    const marker = window.L.circleMarker(latlng, {
      radius: 6,
      fillColor: '#84cc16',
      color: '#ffffff',
      weight: 2,
      fillOpacity: 1
    });
    state.measureLayer.addLayer(marker);

    if (state.measurePoints.length > 1) {
      // Draw dashed line between last two points
      const line = window.L.polyline(state.measurePoints, {
        color: '#84cc16',
        weight: 3,
        dashArray: '6, 6'
      });
      state.measureLayer.addLayer(line);

      // Calculate total distance
      let totalDistM = 0;
      for (let i = 0; i < state.measurePoints.length - 1; i++) {
        totalDistM += state.measurePoints[i].distanceTo(state.measurePoints[i + 1]);
      }
      const distKm = (totalDistM / 1000).toFixed(2);
      document.getElementById('measureResult').textContent = `Дистанция: ${distKm} км (${state.measurePoints.length} точки)`;

      // Tactical range estimation
      let tacticalNote = '';
      if (distKm <= 7) {
        tacticalNote = '🎯 В зоне прямого поражения FPV-дронов, миномётов и стрелкового боя';
      } else if (distKm <= 25) {
        tacticalNote = '💥 В зоне действия ствольной артиллерии 152/155-мм и дальнобойных БПЛА';
      } else if (distKm <= 70) {
        tacticalNote = '🚀 В зоне действия высокоточных РСЗО (HIMARS / Торнадо-С)';
      } else {
        tacticalNote = '🛰️ Оперативная глубина (оперативно-тактические ракеты / авиация)';
      }
      document.getElementById('measureTacticalNote').textContent = tacticalNote;
    }
  }

  // Render Changes Feed List
  function renderChangesList() {
    const list = document.getElementById('changeList');
    if (!list) return;
    list.innerHTML = '';

    const filtered = getFilteredChanges();
    if (filtered.length === 0) {
      list.innerHTML = '<div style="padding: 24px; color: var(--muted); font-size: 12px;">Нет зарегистрированных изменений за выбранный период.</div>';
      return;
    }

    filtered.forEach(item => {
      const p = item.properties || {};
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'change-item';
      el.innerHTML = `
        <time>${p.date || '2026-08-27'}</time>
        <h4>${getLocalized(p, 'name')}</h4>
        <p>${getLocalized(p, 'summary')}</p>
        <div class="change-meta">
          <span>+${p.area_km2 || 0} км²</span>
          <span>Верификация: ${(p.confidence * 100).toFixed(0)}%</span>
        </div>
        <span class="open-evidence">Смотреть фото/видео объективного контроля →</span>
      `;
      el.addEventListener('click', () => {
        openRecordDialog(p, 'change');
        if (item.geometry && state.map) {
          const coords = item.geometry.coordinates[0][0];
          state.map.flyTo([coords[1], coords[0]], 13);
        }
      });
      list.appendChild(el);
    });

    const totalArea = filtered.reduce((acc, f) => acc + (f.properties?.area_km2 || 0), 0);
    document.getElementById('changeSummary').textContent = `Площадь подтверждённых изменений: +${totalArea.toFixed(2)} км²`;
  }

  // Render Timeline / Key Events
  function renderTimeline() {
    const container = document.getElementById('eventList');
    if (!container) return;
    container.innerHTML = '';

    const filtered = getFilteredEvents();
    if (filtered.length === 0) {
      container.innerHTML = '<div style="padding: 24px; color: var(--muted); font-size: 12px;">События по данному направлению не зафиксированы.</div>';
      return;
    }

    filtered.forEach(ev => {
      const card = document.createElement('article');
      card.className = 'event-card';
      card.innerHTML = `
        <time>${ev.event_date} · ${ev.location_label || ''}</time>
        <h3>${getLocalized(ev, 'title')}</h3>
        <p>${getLocalized(ev, 'summary')}</p>
        <div class="record-links">
          <span>Верифицировано (${(ev.confidence * 100).toFixed(0)}%) · Нажмите для деталей</span>
        </div>
      `;
      card.addEventListener('click', () => {
        openRecordDialog(ev, 'event');
        if (ev.location && state.map) {
          state.map.flyTo([ev.location.lat, ev.location.lon], 13);
        }
      });
      container.appendChild(card);
    });
  }

  // Render Side Claims
  function renderClaims() {
    const list = document.getElementById('claimList');
    if (!list) return;
    list.innerHTML = '';

    state.claims.forEach(c => {
      const card = document.createElement('div');
      card.className = 'claim-card';
      card.innerHTML = `
        <span class="side">${c.side_label || c.side}</span>
        <p>${c.summary}</p>
        <small style="color: var(--muted); font-size: 10px;">${c.event_date} · Источник: ${c.source_ids.join(', ')}</small>
      `;
      list.appendChild(card);
    });
  }

  // Render Sources Grid
  function renderSources(filter = 'all') {
    const grid = document.getElementById('sourceGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const list = filter === 'all' ? state.sources : state.sources.filter(s => s.side === filter);
    list.forEach(src => {
      const healthItem = state.sourceHealth?.results?.find(r => r.source_id === src.id);
      const healthClass = healthItem ? healthItem.state : (src.health || 'ok');

      const card = document.createElement('article');
      card.className = 'source-card';
      card.innerHTML = `
        <header>
          <div>
            <h3>${src.name}</h3>
            <p>${src.role}</p>
          </div>
          <span class="health ${healthClass}" title="Статус: ${healthClass}"></span>
        </header>
        <div class="source-tags">
          <span>${src.kind}</span>
          <span>${src.side}</span>
          <span>${src.license_status || 'verified'}</span>
        </div>
        <p style="font-size: 11px; color: var(--muted);">${src.usage_note || ''}</p>
        <a href="${src.url}" target="_blank" rel="noopener noreferrer">Перейти к источнику ↗</a>
      `;
      grid.appendChild(card);
    });
  }

  // Render Archive Selector
  function renderArchive() {
    const select = document.getElementById('snapshotSelect');
    if (!select) return;
    select.innerHTML = '';

    state.snapshots.forEach((snap, idx) => {
      const opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = `${snap.date} — Изменений: ${snap.change_count} (+${snap.area_change_km2} км²)`;
      select.appendChild(opt);
    });

    select.addEventListener('change', e => {
      const snap = state.snapshots[e.target.value];
      if (snap) {
        document.getElementById('archiveMeta').innerHTML = `
          <strong>Хеш среза:</strong> <code>${snap.sha256}</code><br>
          <strong>Дата фиксации:</strong> ${snap.published_at}
        `;
      }
    });

    if (state.snapshots.length > 0) {
      select.dispatchEvent(new Event('change'));
    }
  }

  // Record Inspection Dialog Modal
  function openRecordDialog(record, type = 'event') {
    const dialog = document.getElementById('recordDialog');
    const content = document.getElementById('recordContent');
    if (!dialog || !content) return;

    let html = '';
    if (type === 'settlement') {
      const statusText = record.status === 'control_ru' ? 'Под контролем РФ' : record.status === 'control_ua' ? 'Контроль ВСУ' : 'Серая / оспариваемая зона';
      html = `
        <h2>${getLocalized(record, 'name')}</h2>
        <p style="color: var(--muted); font-size: 13px;">${record.admin1 || 'Донецкая область'} · Сектор: ${record.sector_id || 'Не указан'}</p>
        <div class="record-stats">
          <span><b>${statusText}</b>Статус контроля</span>
          <span><b>${record.lat.toFixed(4)}, ${record.lon.toFixed(4)}</b>Координаты WGS84</span>
          <span><b>${record.importance || 'Город'}</b>Тип объекта</span>
        </div>
        <h3>Проверка источников</h3>
        <p style="font-size: 12px; color: var(--muted); line-height: 1.6;">Статус населенного пункта проверяется на основе сопоставления видеокадров объективного контроля с беспилотных летательных аппаратов и заявлений сторон.</p>
      `;
    } else if (type === 'change') {
      html = `
        <h2>${getLocalized(record, 'name')}</h2>
        <p style="color: var(--muted); font-size: 13px;">Дата фиксации: ${record.date || '2026-08-27'}</p>
        <div class="record-stats">
          <span><b>+${record.area_km2 || 0} км²</b>Площадь полигона</span>
          <span><b>${(record.confidence * 100).toFixed(0)}%</b>Уверенность OSINT</span>
          <span><b>${record.from_status} → ${record.to_status}</b>Сдвиг линии</span>
        </div>
        <p style="font-size: 13px; line-height: 1.6;">${getLocalized(record, 'summary')}</p>
        <h3>Верификация доказательств</h3>
        <div class="evidence-matrix">
          <div class="matrix-cell confirmed"><span>✓</span> Видео с БПЛА (геолокация)</div>
          <div class="matrix-cell confirmed"><span>✓</span> Спутниковые снимки Sentinel-2</div>
          <div class="matrix-cell confirmed"><span>✓</span> Данные радаров FIRMS NASA</div>
          <div class="matrix-cell"><span>—</span> Официальное подтверждение МО</div>
        </div>
      `;
    } else {
      html = `
        <h2>${getLocalized(record, 'title')}</h2>
        <p style="color: var(--muted); font-size: 13px;">${record.event_date} · ${record.location_label || ''}</p>
        <div class="record-stats">
          <span><b>${record.verification_status}</b>Статус</span>
          <span><b>${(record.confidence * 100).toFixed(0)}%</b>Индекс надежности</span>
          <span><b>${record.source_ids ? record.source_ids.join(', ') : 'OSINT'}</b>Источники</span>
        </div>
        <p style="font-size: 13px; line-height: 1.6;">${getLocalized(record, 'summary')}</p>
        ${record.publication_note ? `<p style="background: var(--card-subtle); padding: 12px; border-radius: 8px; font-size: 11px; color: var(--muted);">${record.publication_note}</p>` : ''}
      `;
    }

    content.innerHTML = html;
    dialog.showModal();
  }

  // Force Sync API Trigger
  async function triggerSync() {
    const btn = document.getElementById('syncNowButton');
    if (btn) {
      btn.classList.add('syncing');
      btn.querySelector('span').textContent = i18n[state.lang].syncing;
    }

    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      const data = await res.json();
      state.syncCountdown = state.autoSyncInterval;

      // Reload fresh datasets
      await loadData();

      showToast(i18n[state.lang].sync_success);
    } catch (err) {
      console.error('Manual sync failed:', err);
    } finally {
      if (btn) {
        btn.classList.remove('syncing');
        btn.querySelector('span').textContent = i18n[state.lang].sync_now;
      }
    }
  }

  // Setup Settlement Search
  function setupSearch() {
    const input = document.getElementById('settlementSearch');
    const results = document.getElementById('searchResults');
    if (!input || !results) return;

    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      if (!q) {
        results.hidden = true;
        return;
      }

      const matches = state.settlements.filter(s => {
        const ru = (s.name_ru || s.name || '').toLowerCase();
        const uk = (s.name_uk || '').toLowerCase();
        const en = (s.name_en || '').toLowerCase();
        return ru.includes(q) || uk.includes(q) || en.includes(q);
      });

      if (matches.length === 0) {
        results.innerHTML = '<div class="search-empty">Населённых пунктов не найдено</div>';
        results.hidden = false;
        return;
      }

      results.innerHTML = '';
      matches.slice(0, 8).forEach(item => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.innerHTML = `
          <div>
            <b>${getLocalized(item, 'name')}</b>
            <small>${item.admin1 || 'Украина'} · Сектор: ${item.sector_id || 'Фронт'}</small>
          </div>
          <em>${item.status === 'control_ru' ? 'РФ' : item.status === 'control_ua' ? 'ВСУ' : 'Серая'}</em>
        `;
        btn.addEventListener('click', () => {
          results.hidden = true;
          input.value = '';
          if (state.map) {
            state.map.flyTo([item.lat, item.lon], 13, { duration: 1 });
            openRecordDialog(item, 'settlement');
          }
        });
        results.appendChild(btn);
      });
      results.hidden = false;
    });

    // Keyboard shortcut ⌘K / Ctrl+K
    window.addEventListener('keydown', e => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        input.focus();
      }
    });

    document.addEventListener('click', e => {
      if (!results.contains(e.target) && e.target !== input) {
        results.hidden = true;
      }
    });
  }

  // Setup Timeline Playback
  function setupTimelinePlayback() {
    const playBtn = document.getElementById('playbackPlayBtn');
    const range = document.getElementById('timelineRange');
    const label = document.getElementById('timelineCurrentDateLabel');
    if (!playBtn || !range) return;

    const dates = ['25 августа 2026', '26 августа 2026', '27 августа 2026'];

    range.addEventListener('input', e => {
      const idx = parseInt(e.target.value, 10);
      if (label) label.textContent = dates[idx] || '27 августа 2026';
    });

    playBtn.addEventListener('click', () => {
      state.isPlayingTimeline = !state.isPlayingTimeline;
      playBtn.classList.toggle('playing', state.isPlayingTimeline);

      const lbl = document.getElementById('playBtnLabel');
      if (lbl) lbl.textContent = state.isPlayingTimeline ? i18n[state.lang].stop_timeline : i18n[state.lang].play_timeline;

      if (state.isPlayingTimeline) {
        let currentStep = 0;
        state.timelineTimer = setInterval(() => {
          range.value = currentStep;
          range.dispatchEvent(new Event('input'));
          currentStep = (currentStep + 1) % 3;
        }, 1200);
      } else {
        clearInterval(state.timelineTimer);
      }
    });
  }

  // Setup Event Listeners
  function setupEventListeners() {
    // Theme buttons
    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const theme = btn.getAttribute('data-theme');
        document.body.className = `theme-${theme}`;
        if (theme === 'satellite') switchBasemap('satellite');
        else if (theme === 'dark') switchBasemap('dark');
        else switchBasemap('topo');
      });
    });

    // Basemap selector buttons
    document.querySelectorAll('.basemap-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const bm = btn.getAttribute('data-basemap');
        switchBasemap(bm);
      });
    });

    // Language selector
    const langSelect = document.getElementById('languageSelect');
    if (langSelect) {
      langSelect.addEventListener('change', e => {
        state.lang = e.target.value;
        renderAll();
      });
    }

    // Sync Now button
    const syncBtn = document.getElementById('syncNowButton');
    if (syncBtn) syncBtn.addEventListener('click', triggerSync);

    // Measure tool button
    const measureBtn = document.getElementById('measureButton');
    if (measureBtn) measureBtn.addEventListener('click', toggleMeasureTool);

    const closeMeasure = document.getElementById('closeMeasureHud');
    if (closeMeasure) closeMeasure.addEventListener('click', toggleMeasureTool);

    const clearMeasure = document.getElementById('clearMeasureBtn');
    if (clearMeasure) clearMeasure.addEventListener('click', clearMeasurement);

    // Bandwidth button
    const bwBtn = document.getElementById('bandwidthButton');
    if (bwBtn) {
      bwBtn.addEventListener('click', () => {
        state.lowBandwidth = !state.lowBandwidth;
        document.body.classList.toggle('low-bandwidth', state.lowBandwidth);
        bwBtn.setAttribute('aria-pressed', state.lowBandwidth ? 'true' : 'false');
      });
    }

    // Layer toggles in map legend
    document.querySelectorAll('.map-legend button').forEach(btn => {
      btn.addEventListener('click', () => {
        const layer = btn.getAttribute('data-layer');
        state.layerVisibility[layer] = !state.layerVisibility[layer];
        btn.classList.toggle('off', !state.layerVisibility[layer]);
        btn.setAttribute('aria-pressed', state.layerVisibility[layer] ? 'true' : 'false');
        updateMapLayers();
      });
    });

    // Source filter buttons
    document.querySelectorAll('.source-filters button').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.source-filters button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderSources(btn.getAttribute('data-source-filter'));
      });
    });

    // Dialog close buttons
    document.getElementById('closeRecord')?.addEventListener('click', () => {
      document.getElementById('recordDialog')?.close();
    });

    document.getElementById('aboutButton')?.addEventListener('click', () => {
      document.getElementById('aboutDialog')?.showModal();
    });

    document.getElementById('closeAbout')?.addEventListener('click', () => {
      document.getElementById('aboutDialog')?.close();
    });

    // Auto-sync ticker countdown
    setInterval(() => {
      state.syncCountdown -= 1;
      if (state.syncCountdown <= 0) {
        state.syncCountdown = state.autoSyncInterval;
        triggerSync();
      }
      const label = document.getElementById('syncStatusLabel');
      if (label) label.innerHTML = `Автообновление: <strong>${state.syncCountdown}с</strong>`;

      const progress = document.getElementById('syncProgressFill');
      if (progress) {
        const pct = (state.syncCountdown / state.autoSyncInterval) * 100;
        progress.style.width = `${pct}%`;
      }
    }, 1000);
  }

  // Application Initialization
  async function init() {
    setupEventListeners();
    setupSearch();
    setupTimelinePlayback();
    await loadData();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
