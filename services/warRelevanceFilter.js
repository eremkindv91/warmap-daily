/**
 * WarMap Daily - Precision Relevance & Geocoding Filter Engine
 * Two-stage filtration architecture:
 * STEP A: Strict War Relevance & Negative Filtering (0.0 to 1.0)
 * STEP B: Category Classification & Geographic Sector Assignment with Location Confidence
 */

// Core conflict event categories
export const EVENT_CATEGORIES = {
  FRONTLINE: 'FRONTLINE',
  STRIKE: 'STRIKE',
  DRONE: 'DRONE',
  MISSILE: 'MISSILE',
  AVIATION: 'AVIATION',
  AIR_DEFENSE: 'AIR_DEFENSE',
  NAVY: 'NAVY',
  LOGISTICS: 'LOGISTICS',
  DIPLOMACY: 'DIPLOMACY',
  POLITICS: 'POLITICS',
  MILITARY_AID: 'MILITARY_AID',
  SANCTIONS: 'SANCTIONS',
  INTELLIGENCE: 'INTELLIGENCE',
  OSINT: 'OSINT',
  OTHER: 'OTHER'
};

// Legacy category mapping for backward-compatibility with UI tabs and filters
export const LEGACY_CATEGORY_MAP = {
  FRONTLINE: 'svo_front',
  STRIKE: 'strikes',
  DRONE: 'strikes',
  MISSILE: 'strikes',
  AVIATION: 'strikes',
  AIR_DEFENSE: 'strikes',
  NAVY: 'strikes',
  LOGISTICS: 'svo_front',
  DIPLOMACY: 'negotiations',
  POLITICS: 'negotiations',
  MILITARY_AID: 'negotiations',
  SANCTIONS: 'economy',
  INTELLIGENCE: 'svo_front',
  OSINT: 'svo_front',
  OTHER: 'svo_front'
};

// Negative topic rules: materials falling under these categories are excluded
// UNLESS they contain an explicit, verified link to arms deliveries or military operations in Ukraine.
const NEGATIVE_TOPIC_RULES = [
  {
    id: 'FOREIGN_ELECTIONS',
    label: 'Зарубежные выборы и внутренняя политика',
    regex: /(выборы|эксит-полл|экзитпол|голосован|парламентск|ландтаг|бундестаг|адг|альтернатива для германии|afd|саксони|тюринги|саксонии-анхальт|губернатор|демократы|республиканцы|праймериз|избирательн|партия марин ле пен|джорджа мелони|лейборист|тори|мигрант.*британ)/i,
    // Exception allowed ONLY if explicitly about weapons transfer / military aid to Ukraine
    allowIfMatches: /(поставк.*оружи.*украин|пакет.*помощ.*украин|передач.*(ракет|танков|таурус|taurus|f-16|снаряд).*киев)/i
  },
  {
    id: 'US_GLOBAL_FINANCE',
    label: 'Финансы США, гособлигации, глобальные рынки',
    regex: /(гособлигаци.*сша|облигаци.*сша|us treasuries|treasuries|инвестор.*вложили.*в гособлигации|ставка фрс|фрс сша|джером пауэлл|s&p\s*500|nasdaq|dow jones|уолл-стрит|индекс мосбиржи|индекс ртс|акции apple|акции nvidia|акции tesla|криптовалют|биткоин|рынок золота|доходность трежерис)/i,
    allowIfMatches: null
  },
  {
    id: 'GENERAL_MACROECONOMICS',
    label: 'Общая потребительская макроэкономика и ритейл',
    regex: /(маркетплейс|wildberries|вайлдберриз|ozon|озон|сбербанк.*продаж.*маркетплейс|потребительск.*корзин|льготная ипотека|ставка по ипотеке|вклады физлиц|правила для доноров|аттестат.*поведен|роспотребнадзор|рубини.*назвал.*риск|ключи от пляжа|туристическ.*поток|экспорт фруктов.*афганистан)/i,
    allowIfMatches: null
  },
  {
    id: 'MIDDLE_EAST_WORLD_ENERGY',
    label: 'Нефть Ормузского пролива, Ближний Восток, внешние конфликты',
    regex: /(ормузск|ормуз|баб-эль-мандеб|поставки нефти через ормуз|персидск.*залив|хусит.*красн.*мор|сектор газа|израил.*хамас|хезболл|ливан|кндр.*эсминец|тайвань)/i,
    allowIfMatches: /(передач.*оружи.*(росси|украин)|удар.*(бпла|шахед|дрон).*по украине)/i
  },
  {
    id: 'DOMESTIC_NON_COMBAT_SPORTS',
    label: 'Спорт, шоу-бизнес, быт, происшествия',
    regex: /(футбол|хоккей|кхл|рпл|лига чемпионов|уефа|фифа|формул-1|теннис|турнир|концерт|канье уэст|актер|кино|шоу-бизнес|дтп|сход лавин|пожар в жилом доме|зоопарк|погода в москве|прическа трампа|инфантино|сын трампа.*прилетел)/i,
    allowIfMatches: null
  }
];

// Positive war anchors with thematic weights
const WAR_DIRECT_INDICATORS = [
  // 1. Direct Combat & Frontline (Weight: 0.75 - 0.90)
  {
    id: 'FRONTLINE_COMBAT',
    category: EVENT_CATEGORIES.FRONTLINE,
    regex: /(всу|вс рф|российск.*войск|украинск.*войск|армия рф|линия фронта|линия боевого соприкосновения|лбс|зона сво|наступлен|штурм|контратак|позиционн.*бои|бои за|оборон.*рубеж|плацдарм|окружен|прорыв обороны|освобожден.*населенн|взят.*под контроль|продвижени.*в районе|минобороны рф.*сообщило|генштаб всу|боевые действия|сводка минобороны)/i,
    weight: 0.75
  },
  // 2. Strikes, Weapons & Air Defense (Weight: 0.70 - 0.85)
  {
    id: 'STRIKES_WEAPONS',
    category: EVENT_CATEGORIES.STRIKE,
    regex: /(ракетн.*удар|удар.*(бпла|беспилотник|дрон|шахед|shahed|герань|калибр|кинжал|искандер|атакамс|atacms|storm shadow|каб|фаб|fpv)|пво.*(сбил|уничтож|перехват|отразил|работает|сработал|сбили|уничтожили|перехватили)|(сбил|уничтож|перехват).*беспилотник|уничтож.*(бпла|беспилотник|дрон|ракет)|украинск.*беспилотник|российск.*беспилотник|обстрел.*(белгород|курск|брянск|донецк|харьков|киев|днепр|запорож|херсон|севастопол|курской области|белгородской области)|прилет|падени.*обломков.*(ракет|бпла))/i,
    weight: 0.72
  },
  // 3. Military Aid & Arms Supplies (Weight: 0.75 - 0.90)
  {
    id: 'MILITARY_AID',
    category: EVENT_CATEGORIES.MILITARY_AID,
    regex: /(пакет.*военн.*помощ|военн.*помощ.*(украин|киев|всу)|(украин|киев|всу).*военн.*помощ|поставк.*(вооружен|оружи|снаряд|пво|patriot|himars|f-16|танков|боеприпас)|передал.*(украин|киев).*пакет|коалици.*(снаряд|истребител|дрон|пво)|рамштайн|пентагон.*выделит.*(военн|оружи|боеприпас).*украин|боеприпас.*для.*(patriot|himars|всу)|снаряд.*для.*(всу|украин))/i,
    weight: 0.78
  },
  // 4. War Diplomacy & Peace Talks (Requires explicit mention of Russia-Ukraine war context)
  {
    id: 'WAR_DIPLOMACY',
    category: EVENT_CATEGORIES.DIPLOMACY,
    regex: /(переговор.*(росси.*украин|рф.*украин|москв.*киев|по урегулированию конфликта на украине|по украине|россия–украина|россии и украины|с путиным|с зеленским)|мирн.*план.*(по украине|зеленск)|прекращен.*огня.*(на украине|между россией и украиной|россия–украина)|стамбульск.*договоренност|(уиткофф|кушнер).*(путин|зеленск|переговор|москв|киев|украин|росси)|зеленск.*(донбасс|территори|отказ|уступк|переговор|границ.*1991|завершени.*войн|мирн)|путин.*(требован.*россии по украине|цели сво|мирн.*договор.*украин|условия.*мира)|территориальн.*уступк.*украин|гаранти.*безопасност.*украин)/i,
    weight: 0.75
  },
  // 5. War Sanctions & War Economy (Requires explicit war connection)
  {
    id: 'WAR_SANCTIONS',
    category: EVENT_CATEGORIES.SANCTIONS,
    regex: /(санкци.*против рф.*(из-за войны|из-за конфликта|из-за сво|из-за украины)|потол.*цен на российскую нефть|заморозк.*российских суверенных активов.*для украины|военн.*бюджет рф|впк рф|оборонн.*производств.*рф|санкци.*за поставк.*электроник.*для дронов)/i,
    weight: 0.65
  }
];

// Complete Sector Ontology with verified settlements and frontline direction terms
export const SECTOR_ONTOLOGY = {
  pokrovsk: {
    id: 'pokrovsk',
    name_ru: 'Покровское направление',
    settlements: [
      'покровск', 'покровськ', 'мирноград', 'родинское', 'родинськ', 'удачное', 'удачне',
      'селидово', 'селидове', 'новогродовка', 'новогродівка', 'гродовка', 'гродівка',
      'цукурино', 'цукурине', 'сергеевка', 'сергіївка', 'желанное', 'желанне', 'воздвиженка',
      'новоалександровка', 'новоолександрівка', 'тимофеевка', 'тимофіївка', 'михайловка',
      'красный яр', 'червоний яр', 'крутой яр', 'крутий яр', 'николаевка'
    ],
    front_terms: ['покровск.*направлен', 'покровск.*участ', 'покровск.*сектор', 'покровск.*фронт', 'район покровска', 'районе покровска']
  },
  toretsk: {
    id: 'toretsk',
    name_ru: 'Торецкое направление',
    settlements: [
      'торецк', 'торецьк', 'северное', 'північне', 'железное', 'залізне', 'нью-йорк',
      'новгородское', 'новгородське', 'дружба', 'дачное', 'дачне', 'щербиновка', 'щербинівка',
      'шумы', 'шуми', 'ленинское', 'ленінське', 'артемово', 'забалка'
    ],
    front_terms: ['торецк.*направлен', 'торецк.*участ', 'торецк.*сектор', 'район торецка', 'районе торецка']
  },
  chasiv_yar: {
    id: 'chasiv_yar',
    name_ru: 'Часов Яр',
    settlements: [
      'часов яр', 'часів яр', 'клещеевка', 'кліщіївка', 'андреевка', 'андріївка',
      'богдановка', 'богданівка', 'калиновка', 'калинівка', 'ивановское', 'іванівське',
      'красное', 'ступочки', 'белая гора', 'біла гора', 'григоровка', 'григорівка', 'канал'
    ],
    front_terms: ['часов.*яр.*направлен', 'часовоярск', 'бахмутск.*направлен', 'район часова яра', 'районе часова яра']
  },
  kurakhove_vuhledar: {
    id: 'kurakhove_vuhledar',
    name_ru: 'Курахово — Угледар',
    settlements: [
      'курахово', 'курахове', 'угледар', 'вугледар', 'красногоровка', 'красногорівка',
      'георгиевка', 'георгіївка', 'максимильяновка', 'максимільянівка', 'победа', 'побєда',
      'константиновка', 'костянтинівка', 'водяное', 'водяне', 'павловка', 'павлівка',
      'пречистовка', 'пречистівка', 'богоявленка', 'горняк', 'гірник', 'марьинка', 'мар’їнка'
    ],
    front_terms: ['кураховск.*направлен', 'угледарск.*направлен', 'южнодонецк.*направлен', 'район курахово', 'район угледара']
  },
  kupyansk_lyman: {
    id: 'kupyansk_lyman',
    name_ru: 'Купянск — Лиман',
    settlements: [
      'купянск', 'куп’янськ', 'лиман', 'петропавловка', 'петропавлівка', 'синьковка', 'синьківка',
      'песчаное', 'піщане', 'стельмаховка', 'стельмахівка', 'торское', 'торське', 'ямполовка',
      'ямполівка', 'серебрянск', 'кременная', 'кремінна', 'терны', 'терни', 'макеевка',
      'невское', 'невське', 'двуречная', 'дворічна', 'боровая', 'борова', 'табаевка'
    ],
    front_terms: ['купянск.*направлен', 'лиманск.*направлен', 'краснолиманск.*направлен', 'район купянска', 'район лимана']
  },
  zaporizhzhia: {
    id: 'zaporizhzhia',
    name_ru: 'Запорожское направление',
    settlements: [
      'работино', 'роботине', 'вербовое', 'вербове', 'орехов', 'оріхів', 'гуляйполе',
      'малая токмачка', 'мала токмачка', 'новопокровка', 'каменское', 'кам’янське', 'пятихатки',
      'п’ятихатки', 'васильевка', 'василівка', 'пологи', 'токмак'
    ],
    front_terms: ['запорожск.*направлен', 'ореховск.*направлен', 'гуляйпольск.*направлен', 'район работино', 'район орехова']
  },
  kherson_dnipro: {
    id: 'kherson_dnipro',
    name_ru: 'Херсонское направление',
    settlements: [
      'крынки', 'кринки', 'антоновка', 'антонівка', 'олешки', 'голая пристань', 'гола пристань',
      'казачьи лагери', 'козачі лагері', 'берислав', 'тягинка'
    ],
    front_terms: ['херсонск.*направлен', 'днепровск.*направлен', 'левый берег днепра', 'район крынок']
  }
};

/**
 * Evaluates the geographic location and calculates location_confidence (0.0 to 1.0).
 * Sector is returned ONLY IF location_confidence >= 0.70.
 * Otherwise returns sector = null.
 */
export function classifySectorWithConfidence(text = '', lat = null, lon = null) {
  const lower = (text || '').toLowerCase();
  const detectedLocations = [];

  // Check explicit settlements and front direction keywords per sector
  for (const [secKey, sec] of Object.entries(SECTOR_ONTOLOGY)) {
    // 1. Check exact settlement match
    for (const st of sec.settlements) {
      // Use boundary-safe regex to prevent substring collisions
      const regex = new RegExp(`(^|[^a-zа-яё])${st}([^a-zа-яё]|$)`, 'i');
      if (regex.test(lower)) {
        detectedLocations.push({
          sector: secKey,
          sector_name: sec.name_ru,
          matched_entity: st,
          confidence: 0.95,
          type: 'settlement'
        });
      }
    }

    // 2. Check front direction match
    for (const ft of sec.front_terms) {
      const regex = new RegExp(ft, 'i');
      if (regex.test(lower)) {
        detectedLocations.push({
          sector: secKey,
          sector_name: sec.name_ru,
          matched_entity: ft,
          confidence: 0.85,
          type: 'front_term'
        });
      }
    }
  }

  // If settlement or front direction matched
  if (detectedLocations.length > 0) {
    // Sort by highest confidence
    detectedLocations.sort((a, b) => b.confidence - a.confidence);
    const best = detectedLocations[0];
    return {
      sector: best.confidence >= 0.70 ? best.sector : null,
      sector_name: best.confidence >= 0.70 ? best.sector_name : null,
      location_confidence: best.confidence,
      detected_locations: detectedLocations.map(d => `${d.matched_entity} (${d.sector})`),
      settlement_name: best.matched_entity
    };
  }

  // 3. Check coordinates if provided (e.g. from geocoded event feed)
  if (typeof lat === 'number' && typeof lon === 'number') {
    let coordSector = null;
    let coordName = null;
    if (lat >= 49.2) { coordSector = 'kupyansk_lyman'; coordName = SECTOR_ONTOLOGY.kupyansk_lyman.name_ru; }
    else if (lat >= 48.5 && lon >= 37.6) { coordSector = 'chasiv_yar'; coordName = SECTOR_ONTOLOGY.chasiv_yar.name_ru; }
    else if (lat >= 48.3 && lat < 48.5 && lon >= 37.6) { coordSector = 'toretsk'; coordName = SECTOR_ONTOLOGY.toretsk.name_ru; }
    else if (lat >= 48.0 && lat < 48.4 && lon < 37.6) { coordSector = 'pokrovsk'; coordName = SECTOR_ONTOLOGY.pokrovsk.name_ru; }
    else if (lat >= 47.7 && lat < 48.1) { coordSector = 'kurakhove_vuhledar'; coordName = SECTOR_ONTOLOGY.kurakhove_vuhledar.name_ru; }
    else if (lat < 47.7 && lon > 34.5) { coordSector = 'zaporizhzhia'; coordName = SECTOR_ONTOLOGY.zaporizhzhia.name_ru; }
    else if (lon <= 34.5) { coordSector = 'kherson_dnipro'; coordName = SECTOR_ONTOLOGY.kherson_dnipro.name_ru; }

    if (coordSector) {
      return {
        sector: coordSector,
        sector_name: coordName,
        location_confidence: 0.85,
        detected_locations: [`Coordinates [${lat.toFixed(2)}, ${lon.toFixed(2)}]`],
        settlement_name: null
      };
    }
  }

  // 4. Broad oblast without settlement (confidence 0.55 < 0.70 -> sector is NULL)
  const oblastMatches = lower.match(/(донецк.*област|луганск.*област|харьковск.*област|запорожск.*област|херсонск.*област|курск.*област|белгородск.*област)/i);
  if (oblastMatches) {
    return {
      sector: null, // STRICT RULE: NO SECTOR WITHOUT >= 0.70 CONFIDENCE
      sector_name: null,
      location_confidence: 0.55,
      detected_locations: [oblastMatches[0]],
      settlement_name: null
    };
  }

  // 5. No geographic evidence
  return {
    sector: null,
    sector_name: null,
    location_confidence: 0.0,
    detected_locations: [],
    settlement_name: null
  };
}

/**
 * Evaluates the full war relevance and classification for an article.
 * @param {Object} article { title, description, content, url, source_id, source_name }
 * @returns {Object} Full evaluation report
 */
export function evaluateWarRelevance(article = {}) {
  const title = (article.title || article.title_ru || '').trim();
  const desc = (article.description || article.what_happened || '').trim();
  const fullText = `${title} ${desc}`.trim();
  const lower = fullText.toLowerCase();

  const detectedEntities = [];
  let relevanceScore = 0.0;
  let exclusionReason = null;
  let matchedPositiveId = null;
  let assignedCategory = EVENT_CATEGORIES.OTHER;

  // STEP A: 1. Check Negative Topic Filters
  for (const neg of NEGATIVE_TOPIC_RULES) {
    if (neg.regex.test(lower)) {
      // Check if an explicit weapon / military aid exception rescues this article
      if (neg.allowIfMatches && neg.allowIfMatches.test(lower)) {
        // Allowed by exception
        detectedEntities.push(`Exception: ${neg.id}`);
      } else {
        // Excluded by negative topic
        exclusionReason = `${neg.id}: ${neg.label}`;
        break;
      }
    }
  }

  // If excluded by negative rule and no override
  if (exclusionReason) {
    return {
      is_relevant: false,
      war_relevance_score: 0.05,
      decision: 'EXCLUDED',
      reason: exclusionReason,
      detected_entities: detectedEntities,
      detected_locations: [],
      location_confidence: 0.0,
      category: null,
      sector: null,
      sector_name: null,
      why_included: null,
      why_excluded: `Исключено негативным фильтром (${exclusionReason})`
    };
  }

  // STEP A: 2. Check Positive War Anchors
  for (const ind of WAR_DIRECT_INDICATORS) {
    const match = lower.match(ind.regex);
    if (match) {
      relevanceScore = Math.max(relevanceScore, ind.weight);
      detectedEntities.push(match[0]);
      if (!matchedPositiveId) {
        matchedPositiveId = ind.id;
        assignedCategory = ind.category;
      }
    }
  }

  // Check general war keywords boost
  if (/украин|росси|всу|сво|миноборон|лбс|фронт|дрон|пво/i.test(lower)) {
    if (relevanceScore > 0) {
      relevanceScore = Math.min(0.98, relevanceScore + 0.15);
    }
  }

  // If score is below publication threshold (0.60)
  if (relevanceScore < 0.60) {
    const reason = relevanceScore > 0 ? 'LOW_RELEVANCE' : 'NO_WAR_CONTEXT';
    return {
      is_relevant: false,
      war_relevance_score: Math.round(relevanceScore * 100) / 100,
      decision: relevanceScore >= 0.40 ? 'LOW_RELEVANCE' : 'EXCLUDED',
      reason: `${reason}: Материал не содержит доказанной связи с боевыми действиями или войной РФ-Украина`,
      detected_entities: detectedEntities,
      detected_locations: [],
      location_confidence: 0.0,
      category: null,
      sector: null,
      sector_name: null,
      why_included: null,
      why_excluded: 'Недостаточный индекс релевантности войне (< 0.60)'
    };
  }

  // STEP B: Geographic and Sector Classification
  const geoResult = classifySectorWithConfidence(fullText, article.lat, article.lon);

  const decision = relevanceScore >= 0.80 ? 'CONFIRMED_RELEVANT' : 'REVIEW';
  const reason = `CONFIRMED: ${matchedPositiveId || 'DIRECT_WAR_EVENT'}`;

  return {
    is_relevant: true,
    war_relevance_score: Math.round(relevanceScore * 100) / 100,
    decision,
    reason,
    detected_entities: detectedEntities,
    detected_locations: geoResult.detected_locations,
    location_confidence: geoResult.location_confidence,
    category: assignedCategory,
    legacy_category: LEGACY_CATEGORY_MAP[assignedCategory] || 'svo_front',
    sector: geoResult.sector, // WILL BE NULL IF location_confidence < 0.70
    sector_name: geoResult.sector_name,
    settlement_name: geoResult.settlement_name,
    why_included: `Верифицировано по тематическому индикатору ${matchedPositiveId || 'WAR_EVENT'} (score: ${relevanceScore.toFixed(2)})`,
    why_excluded: null
  };
}

/**
 * Boolean convenience helper for pipeline ingestion
 */
export function is_ukraine_war_relevant(article) {
  const res = evaluateWarRelevance(article);
  return res.is_relevant;
}

/**
 * Final publication validation gate
 */
export function validate_article_for_publication(article) {
  if (!article) return { valid: false, reason: 'EMPTY_ARTICLE' };

  const evalResult = evaluateWarRelevance(article);
  if (!evalResult.is_relevant || evalResult.war_relevance_score < 0.60) {
    return { valid: false, reason: evalResult.why_excluded || evalResult.reason };
  }

  const title = (article.title || article.title_ru || '').trim();
  if (title.length < 10) {
    return { valid: false, reason: 'TITLE_TOO_SHORT' };
  }

  // Strict enforcement: if sector is assigned, location_confidence MUST be >= 0.70
  if (article.sector_id && article.sector_id !== 'general' && article.sector_id !== 'none') {
    if (evalResult.location_confidence < 0.70) {
      return { valid: false, reason: 'FORBIDDEN_FALLBACK_SECTOR: Sector assigned without geographic proof' };
    }
  }

  return {
    valid: true,
    evaluation: evalResult
  };
}
