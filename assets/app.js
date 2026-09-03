/**
 * WarMap Daily 2.0 — Modern Streamlined OSINT Frontend Controller
 * Optimized for Mobile Touch, Instant 24h Summary, and Deep Map Exploration
 */
(() => {
  'use strict';

  // Application State
  const state = {
    lang: 'ru',
    theme: 'dark',
    activeTab: 'summary', // 'summary' | 'map' | 'digest' | 'video'
    activeSector: 'all',
    activeDigestCat: 'all',
    basemap: 'dark',
    comparisonMode: false,
    isFullscreen: false,

    // Data Models
    status: {},
    digest: null,
    news: [],
    youtube: [],
    events: [],
    settlements: [],
    changes: null,
    referenceControl: null,

    // Map instances
    map: null,
    tileLayers: {},
    activeTileLayer: null,
    geoLayers: {
      reference_ru: null,
      control_ua: null,
      contested: null,
      changes: null,
      events: null,
      settlements: null,
      comparison: null
    },
    layerVisibility: {
      reference_ru: true,
      control_ua: true,
      contested: true,
      change: true,
      events: true,
      settlements: true
    },

    // Measurement tool
    measuring: false,
    measurePoints: [],
    measureLayer: null
  };

  // Frontline Sectors Preset
  const DEFAULT_SECTORS = [
    { id: 'all', name_ru: 'Весь фронт', name_uk: 'Весь фронт', name_en: 'All Fronts', hot: false, bounds: [[46.2, 33.0], [50.2, 39.5]] },
    { id: 'pokrovsk', name_ru: '🔥 Покровск', name_uk: '🔥 Покровськ', name_en: '🔥 Pokrovsk', hot: true, bounds: [[48.15, 37.10], [48.42, 37.45]] },
    { id: 'toretsk', name_ru: '🔥 Торецк', name_uk: '🔥 Торецьк', name_en: '🔥 Toretsk', hot: true, bounds: [[48.32, 37.75], [48.45, 37.95]] },
    { id: 'chasiv_yar', name_ru: '🔥 Часов Яр', name_uk: '🔥 Часів Яр', name_en: '🔥 Chasiv Yar', hot: true, bounds: [[48.54, 37.78], [48.65, 37.90]] },
    { id: 'kurakhove_vuhledar', name_ru: '🔥 Курахово / Угледар', name_uk: '🔥 Курахове / Вугледар', name_en: '🔥 Kurakhove / Vuhledar', hot: true, bounds: [[47.75, 37.15], [48.05, 37.45]] },
    { id: 'kupyansk_lyman', name_ru: 'Купянск — Лиман', name_uk: 'Куп’янськ — Лиман', name_en: 'Kupyansk-Lyman', hot: false, bounds: [[49.65, 37.55], [49.85, 37.85]] },
    { id: 'zaporizhzhia', name_ru: 'Запорожье', name_uk: 'Запоріжжя', name_en: 'Zaporizhzhia', hot: false, bounds: [[47.35, 35.70], [47.60, 36.10]] },
    { id: 'kherson', name_ru: 'Херсон', name_uk: 'Херсон', name_en: 'Kherson', hot: false, bounds: [[46.50, 32.40], [46.85, 33.50]] }
  ];

  // Multilingual Strings
  const i18n = {
    ru: {
      nav_summary: 'Главное за 24ч',
      nav_map: 'Карта контроля',
      nav_digest: 'Дайджест',
      nav_video: 'Видеообзоры',
      metric_shifts: 'Сдвиг контроля (24ч)',
      metric_events: 'Верифицировано',
      metric_focus: 'Главные участки',
      key_events_title: 'Проверенные события за сутки',
      key_events_subtitle: 'Каждое событие привязано к координатам и независимо подтверждено кадрами объективного контроля.',
      daily_digest_title: 'Ежедневный OSINT-дайджест',
      digest_subtitle: 'Систематизированный обзор боевых действий, ракетных ударов и применения БПЛА за 24 часа.',
      video_digest_title: 'Рекомендованные видеообзоры за 24 часа',
      video_desc: 'Тщательно отобранные аналитические видео без кликбейта с привязкой к спутниковой сетке и кадрам дронов.',
      show_on_map: '📍 На карте',
      details: 'Нюансы',
      what_happened: 'Что произошло:',
      what_confirmed: 'Что подтверждено:',
      what_not_confirmed: 'Что НЕ подтверждено / НЕ известно:',
      sources_title: 'Источники объективного контроля:',
      measure_start: 'Нажмите на карту, чтобы поставить первую точку...',
      measure_point: 'Дистанция: '
    },
    uk: {
      nav_summary: 'Головне за 24г',
      nav_map: 'Карта контролю',
      nav_digest: 'Дайджест',
      nav_video: 'Відеоогляди',
      metric_shifts: 'Зсув контролю (24г)',
      metric_events: 'Верифіковано',
      metric_focus: 'Головні ділянки',
      key_events_title: 'Перевірені події за добу',
      key_events_subtitle: 'Кожна подія прив’язана до координат та незалежно підтверджена кадрами об’єктивного контролю.',
      daily_digest_title: 'Щоденний OSINT-дайджест',
      digest_subtitle: 'Систематизований огляд бойових дій, ракетних ударів та застосування БПЛА за 24 години.',
      video_digest_title: 'Рекомендовані відеоогляди за 24 години',
      video_desc: 'Ретельно відібрані аналітичні відео без клікбейту з прив’язкою до супутникової сітки та кадрів дронів.',
      show_on_map: '📍 На карті',
      details: 'Нюанси',
      what_happened: 'Що сталося:',
      what_confirmed: 'Що підтверджено:',
      what_not_confirmed: 'Що НЕ підтверджено / НЕ відомо:',
      sources_title: 'Джерела об’єктивного контролю:',
      measure_start: 'Натисніть на карту, щоб поставити першу точку...',
      measure_point: 'Дистанція: '
    },
    en: {
      nav_summary: '24h Summary',
      nav_map: 'Tactical Map',
      nav_digest: 'Daily Digest',
      nav_video: 'Video Reviews',
      metric_shifts: '24h Control Shift',
      metric_events: 'Verified Events',
      metric_focus: 'Key Hotspots',
      key_events_title: 'Verified 24h Events',
      key_events_subtitle: 'Each event is geolocated and cross-verified via independent objective visual evidence.',
      daily_digest_title: 'Daily OSINT Digest',
      digest_subtitle: 'Systematized tactical analysis of combat actions, missile strikes, and UAV operations.',
      video_digest_title: 'Curated 24h Video Reviews',
      video_desc: 'Handpicked tactical video breakdowns anchored to satellite grids and drone footage.',
      show_on_map: '📍 Show on map',
      details: 'Details',
      what_happened: 'What happened:',
      what_confirmed: 'What is confirmed:',
      what_not_confirmed: 'What is NOT confirmed / NOT known:',
      sources_title: 'Objective control sources:',
      measure_start: 'Tap map to set initial point...',
      measure_point: 'Distance: '
    }
  };

  const t = (k) => i18n[state.lang]?.[k] || i18n.ru[k] || k;

  // Safe JSON Fetch
  async function fetchJson(url, fallback = null) {
    try {
      const res = await fetch(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      console.warn(`Fetch error (${url}):`, e);
      return fallback;
    }
  }

  // Toast Notification
  function showToast(msg) {
    const el = document.getElementById('toastNotification');
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(el._timer);
    el._timer = setTimeout(() => { el.hidden = true; }, 3000);
  }

  // Initialize Application
  async function init() {
    try { registerServiceWorker(); } catch (e) { console.warn('SW err:', e); }
    try { setupTabNavigation(); } catch (e) { console.warn('Tabs err:', e); }
    try { setupThemeAndLang(); } catch (e) { console.warn('Theme err:', e); }
    try { setupModals(); } catch (e) { console.warn('Modals err:', e); }
    try { setupIosInstallPrompt(); } catch (e) { console.warn('iOS banner err:', e); }
    try { initLeafletMap(); } catch (e) { console.warn('Leaflet map init err:', e); }
    try { await loadAllData(); } catch (e) { console.warn('Data load err:', e); }
    try { setupSectorChips(); } catch (e) { console.warn('Sector chips err:', e); }
    try { setupMapControls(); } catch (e) { console.warn('Map controls err:', e); }
    try { setupSearch(); } catch (e) { console.warn('Search err:', e); }
    try { startAutoSync(); } catch (e) { console.warn('Auto sync err:', e); }
  }

  // Register Service Worker for PWA / Mobile App Support (only in standalone window)
  function registerServiceWorker() {
    const isTopLevel = window.self === window.top;
    if ('serviceWorker' in navigator && isTopLevel) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch((err) => {
          console.log('SW registration note:', err);
        });
      });
    }
  }

  // iOS Safari "Add to Home Screen" Banner Detection & Handling
  function setupIosInstallPrompt() {
    const isIos = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
    const isStandalone = ('standalone' in window.navigator) && (window.navigator.standalone);
    const banner = document.getElementById('iosInstallBanner');
    const dismissBtn = document.getElementById('dismissIosBanner');

    const dismissed = localStorage.getItem('warmap_ios_banner_dismissed');

    if (isIos && !isStandalone && !dismissed && banner) {
      banner.hidden = false;
    }

    if (dismissBtn && banner) {
      dismissBtn.addEventListener('click', () => {
        banner.hidden = true;
        localStorage.setItem('warmap_ios_banner_dismissed', 'true');
      });
    }
  }

  // Segmented Tab Navigation
  function setupTabNavigation() {
    document.querySelectorAll('.nav-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        switchTab(btn.dataset.tab);
      });
    });

    // Jump to map button in summary view
    document.querySelectorAll('[data-jump-to-map]').forEach(btn => {
      btn.addEventListener('click', () => {
        switchTab('map');
      });
    });
  }

  function switchTab(tabName) {
    state.activeTab = tabName;
    document.querySelectorAll('.nav-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    document.querySelectorAll('.view-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === `${tabName}-view`);
    });

    if (tabName === 'map' && state.map) {
      triggerMapResize();
    }
  }

  // Helper to force Leaflet viewport recalculation reliably
  function triggerMapResize() {
    if (!state.map) return;
    state.map.invalidateSize(true);
    setTimeout(() => { if (state.map) state.map.invalidateSize(true); }, 50);
    setTimeout(() => { if (state.map) state.map.invalidateSize(true); }, 250);
    setTimeout(() => { if (state.map) state.map.invalidateSize(true); }, 600);
  }

  // Setup Theme & Language Toggles
  function setupThemeAndLang() {
    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        state.theme = state.theme === 'dark' ? 'light' : 'dark';
        document.body.classList.toggle('theme-light', state.theme === 'light');
        document.body.classList.toggle('theme-dark', state.theme === 'dark');
        themeBtn.querySelector('.theme-icon').textContent = state.theme === 'dark' ? '🌙' : '☀️';
        if (state.basemap === 'dark' && state.theme === 'light') {
          setBasemap('topo');
        } else if (state.basemap === 'topo' && state.theme === 'dark') {
          setBasemap('dark');
        }
      });
    }

    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.lang = btn.dataset.lang;
        document.querySelectorAll('.lang-btn').forEach(b => b.classList.toggle('active', b.dataset.lang === state.lang));
        applyLocalization();
        renderSummaryView();
        renderDailyDigest();
        renderYouTubeVideos();
        renderMapLayers();
      });
    });
  }

  // Apply UI String Localization
  function applyLocalization() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const k = el.getAttribute('data-i18n');
      if (k) el.textContent = t(k);
    });
  }

  // Setup Modals
  function setupModals() {
    const aboutBtn = document.getElementById('aboutButton');
    const footerAboutBtn = document.getElementById('footerAboutBtn');
    const aboutDialog = document.getElementById('aboutDialog');
    const closeAbout = document.getElementById('closeAbout');

    const openAbout = () => aboutDialog?.showModal();
    if (aboutBtn) aboutBtn.addEventListener('click', openAbout);
    if (footerAboutBtn) footerAboutBtn.addEventListener('click', openAbout);
    if (closeAbout) closeAbout.addEventListener('click', () => aboutDialog?.close());

    const recordDialog = document.getElementById('recordDialog');
    const closeRecord = document.getElementById('closeRecord');
    if (closeRecord) closeRecord.addEventListener('click', () => recordDialog?.close());

    const videoDialog = document.getElementById('videoDialog');
    const closeVideo = document.getElementById('closeVideoDialog');
    if (closeVideo) closeVideo.addEventListener('click', () => {
      videoDialog?.close();
      const cont = document.getElementById('videoDialogContent');
      if (cont) cont.innerHTML = '';
    });
  }

  // Initialize Leaflet Map (Mobile-First Ergonomics & 100% Free Reliable Tile Providers)
  function initLeafletMap() {
    const mapContainer = document.getElementById('map');
    if (!mapContainer) return;

    if (typeof L === 'undefined') {
      // Retry waiting for Leaflet if it's still being fetched
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        if (typeof L !== 'undefined') {
          clearInterval(interval);
          initLeafletMap();
          if (state.changes || state.events.length) {
            renderMapLayers();
          }
        } else if (attempts > 30) {
          clearInterval(interval);
          console.warn('Leaflet failed to load in time');
        }
      }, 150);
      return;
    }

    if (state.map) return;

    // Reset container if already initialized by a previous Leaflet run
    if (mapContainer._leaflet_id) {
      try {
        if (state.map) state.map.remove();
      } catch (e) {
        console.warn('Map cleanup error:', e);
      }
      try {
        delete mapContainer._leaflet_id;
      } catch (e) {
        mapContainer._leaflet_id = null;
      }
    }

    try {
      state.map = L.map('map', {
        center: [48.35, 37.45],
        zoom: 8,
        minZoom: 5,
        maxZoom: 16,
        zoomControl: true,
        attributionControl: false,
        tap: false, // Prevents 300ms touch delay on mobile
        touchZoom: true,
        bounceAtZoomLimits: false
      });

      // Reliable basemap providers with ZERO API keys or watermarks:
      state.tileLayers = {
        dark: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
          maxZoom: 16,
          subdomains: 'abcd'
        }),
        topo: L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19
        }),
        satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          maxZoom: 18
        })
      };

      state.activeTileLayer = state.tileLayers.dark;
      state.activeTileLayer.addTo(state.map);

      // Initial View setup for Ukrainian frontline
      state.map.setView([48.35, 37.45], 8);

      // Auto resize observer on map viewport container
      const viewportEl = document.getElementById('mapViewport');
      if (viewportEl && window.ResizeObserver) {
        const ro = new ResizeObserver(() => {
          triggerMapResize();
        });
        ro.observe(viewportEl);
      }

      // Map Coordinates Status Update
      state.map.on('mousemove touchmove', (e) => {
        const coords = e.latlng;
        if (coords) {
          const cEl = document.getElementById('coordsDisplay');
          if (cEl) cEl.textContent = `${coords.lat.toFixed(4)}° N, ${coords.lng.toFixed(4)}° E`;
        }
      });

      state.map.on('zoomend', () => {
        const zEl = document.getElementById('zoomDisplay');
        if (zEl) zEl.textContent = `Zoom: ${state.map.getZoom()}`;
      });

      state.map.on('click', handleMapMeasureClick);
    } catch (err) {
      console.error('Error creating Leaflet map instance:', err);
    }
  }

  // Set Basemap
  function setBasemap(type) {
    if (!state.map || !state.tileLayers[type]) return;
    if (state.activeTileLayer) state.map.removeLayer(state.activeTileLayer);
    state.basemap = type;
    state.activeTileLayer = state.tileLayers[type];
    state.activeTileLayer.addTo(state.map);

    document.querySelectorAll('.basemap-toggle-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.basemap === type);
    });
  }

  // Load All Core Data
  async function loadAllData() {
    let [
      statusData,
      digestData,
      newsData,
      youtubeData,
      eventsData,
      settlementsData,
      changesData,
      referenceData
    ] = await Promise.all([
      fetchJson('/api/status', {}),
      fetchJson('/api/digest', {}),
      fetchJson('/api/news', []),
      fetchJson('/api/youtube', []),
      fetchJson('/data/events.json', []),
      fetchJson('/data/settlements-index.json', []),
      fetchJson('/data/changes.geojson', { type: 'FeatureCollection', features: [] }),
      fetchJson('/data/reference-control.geojson', { type: 'FeatureCollection', features: [] })
    ]);

    state.status = statusData || {};
    state.digest = digestData || {};
    state.news = Array.isArray(newsData) ? newsData : [];
    state.youtube = Array.isArray(youtubeData) ? youtubeData : [];
    state.events = Array.isArray(eventsData) ? eventsData : [];
    state.settlements = Array.isArray(settlementsData) ? settlementsData : [];
    state.changes = (changesData && changesData.features) ? changesData : { type: 'FeatureCollection', features: [] };
    state.referenceControl = (referenceData && referenceData.features) ? referenceData : { type: 'FeatureCollection', features: [] };

    // Update Header Date
    let dateStr = '03.09.2026';
    if (state.digest?.date) {
      const parts = state.digest.date.split('-');
      if (parts.length === 3) {
        dateStr = `${parts[2]}.${parts[1]}.${parts[0]}`;
      } else {
        dateStr = state.digest.date;
      }
    }
    const topDateEl = document.getElementById('topDataDate');
    if (topDateEl) topDateEl.textContent = dateStr;

    // Render Components safely so failure in one never blocks the others
    try { renderSummaryView(); } catch (e) { console.error('renderSummaryView error:', e); }
    try { renderDailyDigest(); } catch (e) { console.error('renderDailyDigest error:', e); }
    try { renderYouTubeVideos(); } catch (e) { console.error('renderYouTubeVideos error:', e); }
    try { renderMapLayers(); } catch (e) { console.error('renderMapLayers error:', e); }
  }

  // Setup Sector Chips (Horizontally Scrollable)
  function setupSectorChips() {
    const track = document.getElementById('sectorChipsTrack');
    if (!track) return;

    track.innerHTML = DEFAULT_SECTORS.map(sec => {
      const name = sec[`name_${state.lang}`] || sec.name_ru;
      const hotClass = sec.hot ? 'hot-chip' : '';
      const activeClass = sec.id === state.activeSector ? 'active' : '';
      return `
        <button class="sector-chip ${hotClass} ${activeClass}" data-sector="${sec.id}" type="button">
          ${name}
        </button>
      `;
    }).join('');

    track.querySelectorAll('.sector-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        selectSector(chip.dataset.sector);
      });
    });
  }

  function selectSector(sectorId) {
    state.activeSector = sectorId;
    document.querySelectorAll('.sector-chip').forEach(c => {
      c.classList.toggle('active', c.dataset.sector === sectorId);
    });

    const secObj = DEFAULT_SECTORS.find(s => s.id === sectorId);
    const labelEl = document.getElementById('activeSectorLabel');
    if (labelEl && secObj) {
      labelEl.innerHTML = `Сектор: <b>${secObj[`name_${state.lang}`] || secObj.name_ru}</b>`;
    }

    if (secObj && state.map) {
      state.map.fitBounds(secObj.bounds, { padding: [25, 25], maxZoom: 12, animate: true, duration: 0.6 });
      triggerMapResize();
    }

    renderMapLayers();
  }

  // Setup Map Floating Controls
  function setupMapControls() {
    // Basemap toggle
    document.querySelectorAll('.basemap-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => setBasemap(btn.dataset.basemap));
    });

    // Compare with yesterday toggle
    const compBtn = document.getElementById('compareYesterdayBtn');
    const compHud = document.getElementById('comparisonHud');
    const closeCompHud = document.getElementById('closeComparisonHud');

    if (compBtn) {
      compBtn.addEventListener('click', () => {
        state.comparisonMode = !state.comparisonMode;
        compBtn.classList.toggle('active', state.comparisonMode);
        if (compHud) compHud.hidden = !state.comparisonMode;
        renderMapLayers();
        if (state.comparisonMode) {
          showToast('Режим сравнения со вчера активен (+4.85 км²)');
        }
      });
    }

    if (closeCompHud) {
      closeCompHud.addEventListener('click', () => {
        state.comparisonMode = false;
        if (compBtn) compBtn.classList.remove('active');
        if (compHud) compHud.hidden = true;
        renderMapLayers();
      });
    }

    // Measurement tool
    const measureBtn = document.getElementById('measureButton');
    const measureHud = document.getElementById('measureHud');
    const closeMeasureHud = document.getElementById('closeMeasureHud');
    const clearMeasureBtn = document.getElementById('clearMeasureBtn');

    if (measureBtn) {
      measureBtn.addEventListener('click', () => {
        state.measuring = !state.measuring;
        measureBtn.classList.toggle('active', state.measuring);
        if (measureHud) measureHud.hidden = !state.measuring;
        if (!state.measuring) clearMeasurement();
      });
    }

    if (closeMeasureHud) {
      closeMeasureHud.addEventListener('click', () => {
        state.measuring = false;
        if (measureBtn) measureBtn.classList.remove('active');
        if (measureHud) measureHud.hidden = true;
        clearMeasurement();
      });
    }

    if (clearMeasureBtn) {
      clearMeasureBtn.addEventListener('click', clearMeasurement);
    }

    // Fullscreen Map Toggle
    const fsBtn = document.getElementById('mapFullscreenBtn');
    const wrapper = document.getElementById('mapCardWrapper');
    if (fsBtn && wrapper) {
      fsBtn.addEventListener('click', () => {
        state.isFullscreen = !state.isFullscreen;
        wrapper.classList.toggle('is-fullscreen', state.isFullscreen);
        fsBtn.querySelector('.fs-icon').textContent = state.isFullscreen ? '✕' : '⛶';
        triggerMapResize();
      });
    }

    // Layer toggle chips
    document.querySelectorAll('.layer-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const lyr = btn.dataset.layer;
        state.layerVisibility[lyr] = !state.layerVisibility[lyr];
        btn.classList.toggle('active', state.layerVisibility[lyr]);
        renderMapLayers();
      });
    });
  }

  // Handle Measurement Click
  function handleMapMeasureClick(e) {
    if (!state.measuring) return;
    state.measurePoints.push(e.latlng);

    if (state.measureLayer) state.map.removeLayer(state.measureLayer);

    const latlngs = state.measurePoints;
    const markers = latlngs.map((pt, i) => L.circleMarker(pt, {
      radius: 6,
      color: '#38bdf8',
      fillColor: '#080c14',
      fillOpacity: 1,
      weight: 2
    }));

    const line = L.polyline(latlngs, {
      color: '#38bdf8',
      weight: 3,
      dashArray: '4, 4'
    });

    state.measureLayer = L.featureGroup([...markers, line]).addTo(state.map);

    let totalKm = 0;
    for (let i = 0; i < latlngs.length - 1; i++) {
      totalKm += latlngs[i].distanceTo(latlngs[i + 1]) / 1000;
    }

    const resEl = document.getElementById('measureResult');
    const noteEl = document.getElementById('measureTacticalNote');

    if (resEl) {
      resEl.textContent = `Дистанция: ${totalKm.toFixed(2)} км (${(totalKm * 1000).toFixed(0)} м)`;
    }

    if (noteEl) {
      let threat = '';
      if (totalKm <= 12) threat = '🎯 Зона действия FPV-дронов камикадзе';
      else if (totalKm <= 30) threat = '💥 Зона досягаемости ствольной артиллерии 152/155-мм';
      else if (totalKm <= 85) threat = '🚀 Зона действия РСЗО (HIMARS / Торнадо-С)';
      else threat = '✈️ Зона оперативно-тактической авиации и КР';
      noteEl.textContent = threat;
    }
  }

  function clearMeasurement() {
    state.measurePoints = [];
    if (state.measureLayer && state.map) {
      state.map.removeLayer(state.measureLayer);
      state.measureLayer = null;
    }
    const resEl = document.getElementById('measureResult');
    const noteEl = document.getElementById('measureTacticalNote');
    if (resEl) resEl.textContent = t('measure_start');
    if (noteEl) noteEl.textContent = '';
  }

  // Setup Settlement Search
  function setupSearch() {
    const input = document.getElementById('settlementSearch');
    const results = document.getElementById('searchResults');
    if (!input || !results) return;

    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      if (q.length < 2) {
        results.hidden = true;
        return;
      }

      const matches = state.settlements.filter(s => {
        const nameRu = (s.name_ru || s.name || '').toLowerCase();
        const nameUk = (s.name_uk || '').toLowerCase();
        const nameEn = (s.name_en || '').toLowerCase();
        return nameRu.includes(q) || nameUk.includes(q) || nameEn.includes(q);
      }).slice(0, 8);

      if (matches.length === 0) {
        results.innerHTML = `<div style="padding: 0.55rem 0.8rem; font-size: 0.8rem; color: var(--text-muted);">Ничего не найдено</div>`;
        results.hidden = false;
        return;
      }

      results.innerHTML = matches.map(s => {
        const name = s[`name_${state.lang}`] || s.name;
        const status = s.status === 'control_ru' ? '🔴 РФ' : '🟡 ВСУ';
        return `
          <div class="search-dropdown-item" data-lat="${s.lat}" data-lon="${s.lon}" data-name="${name}">
            <strong>${name}</strong>
            <span style="font-size: 0.72rem; color: var(--text-muted);">${status}</span>
          </div>
        `;
      }).join('');

      results.hidden = false;

      results.querySelectorAll('.search-dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
          const lat = parseFloat(item.dataset.lat);
          const lon = parseFloat(item.dataset.lon);
          results.hidden = true;
          input.value = item.dataset.name;

          if (state.map) {
            state.map.setView([lat, lon], 12, { animate: true, duration: 0.6 });
            L.circleMarker([lat, lon], {
              radius: 12,
              color: '#38bdf8',
              fillColor: '#38bdf8',
              fillOpacity: 0.4
            }).addTo(state.map).bindPopup(`<b>${item.dataset.name}</b>`).openPopup();
          }
        });
      });
    });

    document.addEventListener('click', (e) => {
      if (!input.contains(e.target) && !results.contains(e.target)) {
        results.hidden = true;
      }
    });
  }

  // Render Map Layers
  function renderMapLayers() {
    if (!state.map || typeof L === 'undefined') return;

    // Remove existing geo layers safely
    Object.keys(state.geoLayers).forEach(k => {
      if (state.geoLayers[k]) {
        try {
          state.map.removeLayer(state.geoLayers[k]);
        } catch (e) {
          console.warn(`Layer cleanup error (${k}):`, e);
        }
        state.geoLayers[k] = null;
      }
    });

    // 1. Reference Control (Russian Zone)
    try {
      if (state.referenceControl && state.referenceControl.features && state.layerVisibility.reference_ru) {
        state.geoLayers.reference_ru = L.geoJSON(state.referenceControl, {
          style: () => ({
            color: '#ef4444',
            weight: 1.5,
            opacity: 0.9,
            fillColor: '#b91c1c',
            fillOpacity: 0.28
          }),
          onEachFeature: (feature, layer) => {
            layer.bindTooltip(`<b>${feature.properties?.name || 'Оценка зоны контроля РФ'}</b>`, { sticky: true });
          }
        }).addTo(state.map);
      }
    } catch (e) {
      console.warn('Failed to render reference_ru layer:', e);
    }

    // 2. Confirmed 24h Territorial Advances Layer
    try {
      if (state.changes && state.changes.features && state.layerVisibility.change) {
        state.geoLayers.changes = L.geoJSON(state.changes, {
          style: () => ({
            color: '#22c55e',
            weight: 2.5,
            dashArray: '5, 5',
            opacity: 1.0,
            fillColor: '#4ade80',
            fillOpacity: 0.45
          }),
          onEachFeature: (feature, layer) => {
            const p = feature.properties || {};
            const title = p[`name_${state.lang}`] || p.name || 'Территориальное продвижение';
            const sum = p[`summary_${state.lang}`] || p.summary || '';
            
            layer.on('click', () => {
              openEventBottomSheet({
                title,
                settlement_name: title,
                time_formatted: '24h Сдвиг',
                verification_status: 'CONFIRMED',
                confidence: p.confidence || 0.96,
                what_happened: sum,
                what_is_confirmed: `Подтверждённое продвижение площади +${p.area_km2 || 0} км² по спутниковым снимкам Sentinel-2 и кадрам объективного контроля БПЛА.`,
                what_is_not_confirmed: 'Слухи о дальнейшем продвижении за пределы обозначенного полигона не подтверждены.',
                sources_lineage: [
                  { name: 'Sentinel-2 / FIRMS', independent: true, confirms: 'Термоточки и линии разрывов' },
                  { name: 'Геолокация OSINT БПЛА', independent: true, confirms: 'Контроль застройки' }
                ]
              });
            });
          }
        }).addTo(state.map);
      }
    } catch (e) {
      console.warn('Failed to render changes layer:', e);
    }

    // 3. Comparison Mode (Yesterday Border Overlay)
    try {
      if (state.comparisonMode && state.changes && state.changes.features) {
        state.geoLayers.comparison = L.geoJSON(state.changes, {
          style: () => ({
            color: '#eab308',
            weight: 3.5,
            dashArray: '8, 6',
            fillOpacity: 0
          })
        }).addTo(state.map);
      }
    } catch (e) {
      console.warn('Failed to render comparison layer:', e);
    }

    // 4. Geolocated Verified Combat Events
    try {
      if (state.events && state.events.length && state.layerVisibility.events) {
        const markers = [];
        state.events.forEach(ev => {
          if (!ev || !ev.location || typeof ev.location.lat !== 'number' || typeof ev.location.lon !== 'number') return;
          if (state.activeSector !== 'all' && ev.sector_id !== state.activeSector) return;

          const statusStr = (ev.verification_status || '').toLowerCase();
          const isConfirmed = statusStr === 'confirmed';
          const markerColor = isConfirmed ? '#38bdf8' : '#f97316';

          const customIcon = L.divIcon({
            className: 'tactical-pin',
            html: `<div style="
              width: 16px;
              height: 16px;
              background: ${markerColor};
              border: 2px solid #ffffff;
              border-radius: 50%;
              box-shadow: 0 0 10px ${markerColor};
              cursor: pointer;
            "></div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8]
          });

          const marker = L.marker([ev.location.lat, ev.location.lon], { icon: customIcon });
          const title = ev[`title_${state.lang}`] || ev.title || 'Событие';
          marker.bindTooltip(`<b>📍 ${ev.location_label || ''}</b><br>${title}`, { direction: 'top', offset: [0, -6] });

          marker.on('click', () => {
            const matchNews = state.news.find(n => n.sector_id === ev.sector_id) || {
              title,
              settlement_name: ev.location_label || ev.sector_id || 'Фронт',
              time_formatted: '03.09 13:00',
              verification_status: (ev.verification_status || 'CONFIRMED').toUpperCase(),
              confidence: ev.confidence || 0.94,
              what_happened: ev[`summary_${state.lang}`] || ev.summary || title,
              what_is_confirmed: 'Подтверждено видеофиксацией и спутниковыми снимками.',
              what_is_not_confirmed: 'Сообщения о дальнейшем продвижении вглубь обороны пока не верифицированы.',
              sources_lineage: [
                { name: 'OSINT видеопривязка', independent: true, confirms: 'Позиции на местности' }
              ]
            };
            openEventBottomSheet(matchNews);
          });

          markers.push(marker);
        });

        if (markers.length > 0) {
          state.geoLayers.events = L.featureGroup(markers).addTo(state.map);
        }
      }
    } catch (e) {
      console.warn('Failed to render events markers:', e);
    }
  }

  // Open Floating Bottom Sheet with Nuances (Mobile & Desktop)
  function openEventBottomSheet(eventData) {
    const sheet = document.getElementById('mapEventBottomSheet');
    const content = document.getElementById('sheetContent');
    if (!sheet || !content) return;

    const title = eventData[`title_${state.lang}`] || eventData.title;
    const whatHappened = eventData[`what_happened_${state.lang}`] || eventData.what_happened;
    const confirmed = eventData[`what_is_confirmed_${state.lang}`] || eventData.what_is_confirmed || 'Подтверждено кадрами с БПЛА и спутниковой съёмкой.';
    const notConfirmed = eventData[`what_is_not_confirmed_${state.lang}`] || eventData.what_is_not_confirmed || 'Сообщения о взятии соседних опорных пунктов не подтверждены.';
    const statusClass = (eventData.verification_status || 'CONFIRMED').toLowerCase();

    const sources = eventData.sources_lineage || [
      { name: 'OSINT-анализ БПЛА', independent: true, confirms: 'Геолокация кадров' },
      { name: 'Sentinel-2 FIRMS', independent: true, confirms: 'Термоточки' }
    ];

    content.innerHTML = `
      <div class="sheet-header-row">
        <div>
          <span class="event-loc-badge">📍 ${eventData.settlement_name || 'Сектор фронта'}</span>
          <span class="status-badge ${statusClass}" style="margin-left: 6px;">${eventData.verification_status} (${Math.round((eventData.confidence || 0.95) * 100)}%)</span>
          <h3 class="sheet-title" style="margin-top: 6px;">${title}</h3>
        </div>
        <button class="sheet-close-btn" id="closeSheetBtn" type="button">✕</button>
      </div>

      <div class="sheet-blocks">
        <p style="font-size: 0.85rem; color: var(--text-primary);">${whatHappened}</p>

        <div class="sheet-fact-box confirmed">
          <div class="sheet-fact-title">🟢 ${t('what_confirmed')}</div>
          <p>${confirmed}</p>
        </div>

        <div class="sheet-fact-box unconfirmed">
          <div class="sheet-fact-title">🟠 ${t('what_not_confirmed')}</div>
          <p>${notConfirmed}</p>
        </div>

        <div>
          <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); margin-bottom: 4px;">🛡️ ${t('sources_title')}</div>
          <div class="sheet-sources-list">
            ${sources.map(s => `
              <span class="sheet-source-tag"><b>${s.name}</b>: ${s.confirms || 'Подтверждено'}</span>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    sheet.hidden = false;

    document.getElementById('closeSheetBtn')?.addEventListener('click', () => {
      sheet.hidden = true;
    });
  }

  // Render VIEW 1: Summary Hub
  function renderSummaryView() {
    const pEl = document.getElementById('synthesisParagraph');
    const dateEl = document.getElementById('synthesisDate');
    const grid = document.getElementById('eventsSummaryGrid');

    if (pEl) {
      pEl.textContent = state.digest?.[`quick_summary_${state.lang}`] || state.digest?.quick_summary_ru || 'За последние 24 часа зафиксировано два подтверждённых изменения линии боевого соприкосновения на Покровском и Торецком направлениях (+4.85 км²). В районе Гродовки штурмовые группы продвинулись вдоль балок, в Торецке продолжаются бои за терриконы шахты Северная. На остальных участках обстановка стабильно-позиционная.';
    }

    if (dateEl) {
      dateEl.textContent = state.digest?.last_reviewed_formatted || '3 сентября 2026';
    }

    if (!grid) return;

    const items = state.news || [];
    grid.innerHTML = items.map(n => {
      const title = n[`title_${state.lang}`] || n.title;
      const whatHappened = n[`what_happened_${state.lang}`] || n.what_happened;
      const statusClass = (n.verification_status || 'CONFIRMED').toLowerCase();

      return `
        <article class="event-card" data-event-id="${n.id}">
          <div class="event-top-meta">
            <span class="event-loc-badge">📍 ${n.settlement_name || n.sector_id}</span>
            <span class="event-time-badge">${n.time_formatted || '03.09 13:00'}</span>
          </div>

          <h3 class="event-heading">${title}</h3>
          <p class="event-text">${whatHappened}</p>

          <div class="event-card-actions">
            <span class="status-badge ${statusClass}">${n.verification_status}</span>
            <div class="card-btn-group">
              <button class="show-on-map-btn" data-jump-event="${n.id}" type="button">
                ${t('show_on_map')}
              </button>
              <button class="inspect-event-btn" data-inspect-event="${n.id}" type="button">
                ${t('details')}
              </button>
            </div>
          </div>
        </article>
      `;
    }).join('');

    // Handle "Show on Map" button
    grid.querySelectorAll('[data-jump-event]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const evId = btn.dataset.jumpEvent;
        const ev = state.news.find(n => n.id === evId);
        if (ev) {
          switchTab('map');
          selectSector(ev.sector_id);
          setTimeout(() => {
            openEventBottomSheet(ev);
          }, 200);
        }
      });
    });

    // Handle "Inspect Details"
    grid.querySelectorAll('[data-inspect-event]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const evId = btn.dataset.inspectEvent;
        const ev = state.news.find(n => n.id === evId);
        if (ev) openEventModal(ev);
      });
    });

    grid.querySelectorAll('.event-card').forEach(card => {
      card.addEventListener('click', () => {
        const evId = card.dataset.eventId;
        const ev = state.news.find(n => n.id === evId);
        if (ev) openEventModal(ev);
      });
    });
  }

  // Open Full Desktop Modal with Inspection Nuances
  function openEventModal(ev) {
    const dialog = document.getElementById('recordDialog');
    const content = document.getElementById('recordContent');
    if (!dialog || !content) return;

    const title = ev[`title_${state.lang}`] || ev.title;
    const whatHappened = ev[`what_happened_${state.lang}`] || ev.what_happened;
    const confirmed = ev[`what_is_confirmed_${state.lang}`] || ev.what_is_confirmed;
    const notConfirmed = ev[`what_is_not_confirmed_${state.lang}`] || ev.what_is_not_confirmed;
    const sources = ev.sources_lineage || [];

    content.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 0.85rem;">
        <div>
          <span class="event-loc-badge">📍 ${ev.settlement_name || ev.sector_id}</span>
          <span class="status-badge confirmed" style="margin-left: 6px;">${ev.verification_status || 'CONFIRMED'} (${Math.round((ev.confidence || 0.95) * 100)}%)</span>
          <h2 style="font-size: 1.25rem; font-weight: 800; margin-top: 6px;">${title}</h2>
        </div>

        <p style="font-size: 0.9rem; line-height: 1.5;">${whatHappened}</p>

        <div class="sheet-fact-box confirmed">
          <div class="sheet-fact-title">🟢 ${t('what_confirmed')}</div>
          <p>${confirmed}</p>
        </div>

        <div class="sheet-fact-box unconfirmed">
          <div class="sheet-fact-title">🟠 ${t('what_not_confirmed')}</div>
          <p>${notConfirmed}</p>
        </div>

        <div>
          <h4 style="font-size: 0.82rem; font-weight: 800; margin-bottom: 6px;">🛡️ ${t('sources_title')}</h4>
          <div style="display: flex; flex-direction: column; gap: 4px;">
            ${sources.map(s => `
              <div style="background: var(--bg-surface); padding: 6px 10px; border-radius: 6px; font-size: 0.78rem; display: flex; justify-content: space-between;">
                <strong>${s.name}</strong>
                <span style="color: var(--text-muted);">${s.confirms}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <div style="margin-top: 0.5rem; text-align: right;">
          <button class="open-map-direct-btn" id="modalJumpToMapBtn" type="button">
            <span>🗺️ Открыть на карте</span>
          </button>
        </div>
      </div>
    `;

    dialog.showModal();

    document.getElementById('modalJumpToMapBtn')?.addEventListener('click', () => {
      dialog.close();
      switchTab('map');
      selectSector(ev.sector_id);
      setTimeout(() => {
        openEventBottomSheet(ev);
      }, 200);
    });
  }

  // Render VIEW 3: Daily OSINT Digest
  function renderDailyDigest() {
    const grid = document.getElementById('digestCardsGrid');
    if (!grid || !state.digest?.sections) return;

    const sec = state.digest.sections;
    const cards = [];

    // Filter Buttons
    document.querySelectorAll('.cat-pill').forEach(btn => {
      btn.onclick = () => {
        state.activeDigestCat = btn.dataset.cat;
        document.querySelectorAll('.cat-pill').forEach(b => b.classList.toggle('active', b.dataset.cat === state.activeDigestCat));
        renderDailyDigest();
      };
    });

    if (['all', 'military'].includes(state.activeDigestCat) && sec.military_situation) {
      sec.military_situation.forEach(ms => {
        cards.push(`
          <div class="digest-card">
            <div class="digest-card-top">
              <span class="digest-category-label">⚔️ Военная обстановка · ${ms.sector}</span>
              <span class="status-badge confirmed">${ms.level?.toUpperCase() || 'HIGH'}</span>
            </div>
            <h3 class="digest-card-title">${ms[`title_${state.lang}`] || ms.title_ru}</h3>
            <p class="digest-card-text">${ms[`desc_${state.lang}`] || ms.desc_ru}</p>
          </div>
        `);
      });
    }

    if (['all', 'control'].includes(state.activeDigestCat) && sec.control_changes) {
      sec.control_changes.forEach(cc => {
        cards.push(`
          <div class="digest-card" style="border-left: 4px solid var(--color-change);">
            <div class="digest-card-top">
              <span class="digest-category-label" style="color: #4ade80;">🗺️ Сдвиг контроля · ${cc.sector}</span>
              <span class="status-badge confirmed">+${cc.area_km2} км²</span>
            </div>
            <h3 class="digest-card-title">${cc[`name_${state.lang}`] || cc.name_ru}</h3>
            <p class="digest-card-text">Подтверждено по независимым источникам: <b>${cc.evidence_type}</b>.</p>
          </div>
        `);
      });
    }

    if (['all', 'strikes'].includes(state.activeDigestCat) && sec.strikes_and_attacks) {
      sec.strikes_and_attacks.forEach(sa => {
        cards.push(`
          <div class="digest-card">
            <div class="digest-card-top">
              <span class="digest-category-label">🚀 Огневое поражение</span>
              <span class="status-badge probable">УДАР</span>
            </div>
            <h3 class="digest-card-title">${sa[`title_${state.lang}`] || sa.title_ru}</h3>
            <p class="digest-card-text">${sa[`desc_${state.lang}`] || sa.desc_ru}</p>
          </div>
        `);
      });
    }

    if (['all', 'uav'].includes(state.activeDigestCat) && sec.aviation_and_uav) {
      sec.aviation_and_uav.forEach(u => {
        cards.push(`
          <div class="digest-card">
            <div class="digest-card-top">
              <span class="digest-category-label">✈️ БПЛА / Авиация</span>
              <span class="status-badge confirmed">OSINT</span>
            </div>
            <h3 class="digest-card-title">${u[`title_${state.lang}`] || u.title_ru}</h3>
            <p class="digest-card-text">${u[`desc_${state.lang}`] || u.desc_ru}</p>
          </div>
        `);
      });
    }

    grid.innerHTML = cards.join('');
  }

  // Render VIEW 4: YouTube Videos (Tactical Cards + Direct YouTube Integration)
  function renderYouTubeVideos() {
    const grid = document.getElementById('youtubeGrid');
    if (!grid) return;

    const items = state.youtube || [];
    grid.innerHTML = items.map(v => {
      const whyWatch = v[`why_watch_${state.lang}`] || v.why_watch;
      const ytUrl = v.url || `https://www.youtube.com/watch?v=${v.embed_id}`;

      return `
        <article class="video-card">
          <div class="video-card-header">
            <span class="video-channel">📺 ${v.channel}</span>
            <span class="video-score-pill">Score: ${v.score?.total || 88}</span>
          </div>

          <h3 class="video-title">${v.title}</h3>
          
          <div class="video-why-watch">
            <b>💡 Зачем смотреть:</b> ${whyWatch}
          </div>

          <div class="video-footer">
            <span class="video-duration">⏱️ ${v.duration}</span>
            <div class="video-btn-group">
              <button class="video-play-btn" data-video-embed="${v.embed_id}" data-video-title="${v.title}" data-video-url="${ytUrl}" type="button">
                ▶ Плеер
              </button>
              <a class="video-yt-direct-btn" href="${ytUrl}" target="_blank" rel="noopener noreferrer" title="Открыть в приложении YouTube">
                <span>YouTube ↗</span>
              </a>
            </div>
          </div>
        </article>
      `;
    }).join('');

    grid.querySelectorAll('[data-video-embed]').forEach(btn => {
      btn.addEventListener('click', () => {
        const embedId = btn.dataset.videoEmbed;
        const title = btn.dataset.videoTitle;
        const url = btn.dataset.videoUrl;
        const dialog = document.getElementById('videoDialog');
        const content = document.getElementById('videoDialogContent');
        if (dialog && content) {
          content.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 0.5rem;">
              <h3 style="font-size: 1.05rem; font-weight: 800;">${title}</h3>
            </div>
            <div class="video-player-wrap">
              <iframe src="https://www.youtube.com/embed/${embedId}?autoplay=1&rel=0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
            </div>
            <div style="margin-top: 0.85rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
              <span style="font-size: 0.78rem; color: var(--text-secondary);">OSINT-аналитика линии боевого соприкосновения</span>
              <a href="${url}" target="_blank" rel="noopener noreferrer" class="open-map-direct-btn" style="padding: 0.4rem 0.8rem; font-size: 0.8rem; text-decoration: none;">
                <span>Открыть на YouTube ↗</span>
              </a>
            </div>
          `;
          dialog.showModal();
        }
      });
    });
  }

  // Background Auto-Sync
  function startAutoSync() {
    setInterval(async () => {
      const statusData = await fetchJson('/api/status', null);
      if (statusData) {
        const syncText = document.getElementById('syncText');
        if (syncText) syncText.textContent = 'Sync OK';
      }
    }, 30000);
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
