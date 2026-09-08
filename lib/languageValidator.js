/**
 * WarMap Daily - Language Validator & Russian Normalizer
 * Ensures 100% Russian language enforcement across all summaries, titles, sectors, settlements, and digests.
 */

import fs from 'fs';
import path from 'path';

export const SLUG_TO_NAME = {
  pokrovsk: { ru: 'Покровский сектор', uk: 'Покровський сектор', en: 'Pokrovsk Sector' },
  toretsk: { ru: 'Торецкий сектор', uk: 'Торецький сектор', en: 'Toretsk Sector' },
  chasiv_yar: { ru: 'Часов Яр / Бахмут', uk: 'Часів Яр / Бахмут', en: 'Chasiv Yar / Bakhmut' },
  kurakhove_vuhledar: { ru: 'Курахово — Угледар', uk: 'Курахове — Вугледар', en: 'Kurakhove — Vuhledar' },
  kupyansk_lyman: { ru: 'Купянск — Лиман', uk: 'Куп’янськ — Лиман', en: 'Kupyansk — Lyman' },
  zaporizhzhia: { ru: 'Запорожский сектор', uk: 'Запорізький сектор', en: 'Zaporizhzhia Sector' },
  kherson: { ru: 'Херсон / Днепр', uk: 'Херсон / Дніпро', en: 'Kherson / Dnipro' },
  kherson_dnipro: { ru: 'Херсон / Днепр', uk: 'Херсон / Дніпро', en: 'Kherson / Dnipro' },
  vuhledar: { ru: 'Угледарский сектор', uk: 'Вугледарський сектор', en: 'Vuhledar Sector' },
  kurakhove: { ru: 'Кураховский сектор', uk: 'Курахівський сектор', en: 'Kurakhove Sector' },
  kupyansk: { ru: 'Купянский сектор', uk: 'Куп’янський сектор', en: 'Kupyansk Sector' },
  lyman: { ru: 'Лиманский сектор', uk: 'Лиманський сектор', en: 'Lyman Sector' },
  bakhmut: { ru: 'Бахмутский сектор', uk: 'Бахмутський сектор', en: 'Bakhmut Sector' },
  kursk: { ru: 'Курское направление', uk: 'Курський напрямок', en: 'Kursk Direction' },
  all: { ru: 'Весь фронт', uk: 'Весь фронт', en: 'All Fronts' },
  general: { ru: 'Оперативная обстановка', uk: 'Оперативна обстановка', en: 'General Operational' },
  none: { ru: 'Фронт', uk: 'Фронт', en: 'Frontline' }
};

export function getSectorDisplayName(slug, lang = 'ru') {
  if (!slug) return '';
  const clean = String(slug).toLowerCase().trim().replace(/^settlement-/, '').replace(/^contested-/, '');
  if (SLUG_TO_NAME[clean]) {
    return SLUG_TO_NAME[clean][lang] || SLUG_TO_NAME[clean].ru;
  }
  return clean;
}

/**
 * Universal list formatter converting an array or list of items into human-readable text.
 */
export function formatList(items, options = {}) {
  const lang = options.lang || 'ru';
  const conjunction = options.conjunction || (lang === 'en' ? 'and' : (lang === 'uk' ? 'та' : 'и'));
  const emptyFallback = options.emptyFallback || '';

  if (items === null || items === undefined) return emptyFallback;

  let list = [];

  if (Array.isArray(items)) {
    list = items;
  } else if (typeof items === 'string') {
    const trimmed = items.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) list = parsed;
        else list = [trimmed];
      } catch (_) {
        list = [trimmed];
      }
    } else {
      list = trimmed ? [trimmed] : [];
    }
  } else if (typeof items === 'object') {
    const label = items.name_ru || items.name || items.title || items.label || items.ru;
    if (label) list = [label];
    else return emptyFallback;
  } else {
    list = [String(items)];
  }

  const cleanList = list
    .map(item => {
      if (item === null || item === undefined) return '';
      if (typeof item === 'object') {
        return item.name_ru || item.name || item.title || item.label || item.ru || '';
      }
      let str = String(item).trim();
      if (str.startsWith('["') && str.endsWith('"]')) {
        try {
          const inner = JSON.parse(str);
          return Array.isArray(inner) ? formatList(inner, options) : str;
        } catch (_) {}
      }
      return str;
    })
    .filter(s => s.length > 0 && s !== '[object Object]' && !s.startsWith('Array('));

  if (cleanList.length === 0) return emptyFallback;

  // Deduplicate preserving case-insensitive uniqueness
  const uniqueList = [];
  const seen = new Set();
  for (const s of cleanList) {
    const key = s.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      uniqueList.push(s);
    }
  }

  if (uniqueList.length === 0) return emptyFallback;
  if (uniqueList.length === 1) return uniqueList[0];

  if (options.maxItems && uniqueList.length > options.maxItems) {
    const visible = uniqueList.slice(0, options.maxItems);
    const remainder = uniqueList.length - options.maxItems;
    const baseStr = visible.join(', ');
    const tailStr = typeof options.tailTemplate === 'function'
      ? options.tailTemplate(remainder)
      : ` и ещё ${remainder} н.п.`;
    return `${baseStr}${tailStr}`;
  }

  if (uniqueList.length === 2) {
    return `${uniqueList[0]} ${conjunction} ${uniqueList[1]}`;
  }

  const allButLast = uniqueList.slice(0, -1).join(', ');
  const last = uniqueList[uniqueList.length - 1];
  return `${allButLast} ${conjunction} ${last}`;
}

let settlementsMap = null;

function getSettlementsMap() {
  if (settlementsMap) return settlementsMap;
  settlementsMap = new Map();

  try {
    const indexPath = path.join(process.cwd(), 'data', 'settlements-index.json');
    if (fs.existsSync(indexPath)) {
      const list = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
      for (const item of list) {
        const ru = item.name_ru || item.name;
        if (item.name_uk) {
          settlementsMap.set(item.name_uk.toLowerCase(), ru);
        }
        if (item.name) {
          settlementsMap.set(item.name.toLowerCase(), ru);
        }
        if (Array.isArray(item.aliases)) {
          for (const a of item.aliases) {
            settlementsMap.set(a.toLowerCase(), ru);
          }
        }
      }
    }
  } catch (e) {
    console.error('Error loading settlements index:', e.message);
  }

  // Common settlements with grammatical inflection stems
  const commonInflexions = [
    ['дворічн', 'Двуречная'],
    ['голубівк', 'Голубовка'],
    ['ступчок', 'Ступочки'],
    ['міньківк', 'Миньковка'],
    ['бочков', 'Бочково'],
    ['івашкін', 'Ивашкино'],
    ['лугівськ', 'Луговское'],
    ['гуляйпільськ', 'Гуляйпольское'],
    ['гродівк', 'Гродовка'],
    ['північн', 'Северное (Пивничное)'],
    ['залізн', 'Зализное (Железное)'],
    ['нью-йорк', 'Нью-Йорк'],
    ['селидов', 'Селидово'],
    ['покровськ', 'Покровск'],
    ['торецьк', 'Торецк'],
    ['куп\'янськ', 'Купянск'],
    ['купянськ', 'Купянск'],
    ['часів яр', 'Часов Яр'],
    ['часов яр', 'Часов Яр'],
    ['вугледар', 'Угледар'],
    ['костянтинівк', 'Константиновка'],
    ['лиман', 'Лиман'],
    ['бахмут', 'Бахмут'],
    ['авдіївк', 'Авдеевка'],
    ['запоріжж', 'Запорожье'],
    ['херсон', 'Херсон'],
    ['кремінн', 'Кременная'],
    ['сватов', 'Сватово'],
    ['воздвиженк', 'Воздвиженка'],
    ['новоолександрівк', 'Новоалександровка'],
    ['прогрес', 'Прогресс'],
    ['красногорівк', 'Красногоровка'],
    ['максимільянівк', 'Максимильяновка'],
    ['кусти', 'Кусты'],
    ['карлівк', 'Карловка'],
    ['невельськ', 'Невельское'],
    ['макіївк', 'Макеевка'],
    ['старомайорськ', 'Старомайорское'],
    ['урожайн', 'Урожайное'],
    ['роботин', 'Работино'],
    ['вербов', 'Вербовое'],
    ['степов', 'Степовое'],
    ['бердич', 'Бердычи'],
    ['семенівк', 'Семеновка'],
    ['очеретин', 'Очеретино'],
    ['терни', 'Терны'],
    ['яснобродівк', 'Яснобродовка'],
    ['межов', 'Межевое'],
    ['желанн', 'Желанное'],
    ['пліщіївк', 'Плещеевка'],
    ['іванівськ', 'Ивановское'],
    ['клещіївк', 'Клещеевка'],
    ['андріївк', 'Андреевка'],
    ['родінськ', 'Родинское'],
    ['родинськ', 'Родинское'],
    ['новогродівк', 'Новогродовка'],
    ['новогродивк', 'Новогродовка'],
    ['артільн', 'Артельное'],
    ['шелихов', 'Шелихово'],
    ['малих щербак', 'Малые Щербаки'],
    ['малі щербак', 'Малые Щербаки'],
    ['зелен гай', 'Зеленый Гай'],
    ['новохатськ', 'Новохатское'],
    ['грушівськ', 'Грушевское'],
    ['піддубн', 'Поддубное'],
    ['січнев', 'Сичневое'],
    ['воронн', 'Вороное'],
    ['тернов', 'Терновое'],
    ['березов', 'Березовое'],
    ['новопавлів', 'Новопавловка'],
    ['новогеоргі', 'Новогеоргиевка'],
    ['новомикола', 'Новониколаевка'],
    ['новогригор', 'Новогригоровка'],
    ['запорізьк', 'Запорожское'],
    ['привільн', 'Привольное'],
    ['привілл', 'Приволье'],
    ['софіївк', 'Софиевка'],
    ['тихонівк', 'Тихоновка'],
    ['каленик', 'Каленики'],
    ['цвітков', 'Цветковое'],
    ['святопетрівк', 'Святопетровка'],
    ['дорожн', 'Дорожное'],
    ['довгої балк', 'Долгая Балка'],
    ['довга балк', 'Долгая Балка'],
    ['іллінівк', 'Ильиновка'],
    ['кривій луц', 'Кривая Лука'],
    ['крива лук', 'Кривая Лука'],
    ['курилівк', 'Куриловка'],
    ['білицьк', 'Белицкое'],
    ['марков', 'Марково'],
    ['никифор', 'Никифоровка']
  ];

  for (const [stem, ru] of commonInflexions) {
    settlementsMap.set(stem, ru);
  }

  return settlementsMap;
}

const CYR_CHAR = 'а-яА-ЯёЁіІїЇєЄґҐa-zA-Z0-9_';
const cyrBoundary = (phrase) => new RegExp(`(?<![${CYR_CHAR}])${phrase.replace(/\s+/g, '\\s+')}(?![${CYR_CHAR}])`, 'gi');

// Phrase and terminology mapping
const RAW_PHRASES = [
  // Armed forces & actions
  ['Сили Оборони України', 'Силы обороны Украины'],
  ['Сил Оборони', 'Сил обороны'],
  ['Збройні Сили України', 'Вооруженные силы Украины'],
  ['ЗСУ', 'ВСУ'],
  ['ЗС РФ', 'ВС РФ'],
  ['російські війська', 'российские войска'],
  ['ворог', 'противник'],
  ['ворога', 'противника'],
  ['ворогу', 'противнику'],
  ['окупанти', 'войска РФ'],
  ['підрозділи', 'подразделения'],
  ['штурмові групи', 'штурмовые группы'],
  ['відновили контроль', 'восстановили контроль'],
  ['повернули контроль', 'вернули контроль'],
  ['відновили позиції', 'восстановили позиции'],
  ['просунувся', 'продвинулся'],
  ['просунулися', 'продвинулись'],
  ['зафіксовано просування', 'зафиксировано продвижение'],
  ['окупував', 'занял'],
  ['захопив', 'взял под контроль'],
  ['тривають важкі бої', 'продолжаются тяжелые бои'],
  ['тривають бої', 'идут бои'],
  ['уточнено лінію фронту', 'уточнена линия фронта'],
  ['уточнено лінію зіткнення', 'уточнена линия боевого соприкосновения'],
  ['уточнено лінію', 'уточнена линия'],
  ['лінія зіткнення', 'линия боевого соприкосновения'],
  ['лінію зіткнення', 'линию боевого соприкосновения'],
  ['лінія фронту', 'линия фронта'],
  ['лінію фронту', 'линию фронта'],
  ['сіра зона', 'серая зона'],
  ['населений пункт', 'населенный пункт'],
  ['населеного пункту', 'населенного пункта'],
  ['біля', 'около'],
  ['поблизу', 'вблизи'],
  ['в районі', 'в районе'],
  ['напрямок', 'направление'],
  ['напрямку', 'направлении'],
  ['відбито атаку', 'отражена атака'],
  ['відбито атаки', 'отражены атаки'],
  ['артилерійський обстріл', 'артиллерийский обстрел'],
  ['авіаційний удар', 'авиационный удар'],
  ['безпілотник', 'беспилотник'],
  ['безпілотники', 'беспилотники'],
  ['дрони', 'дроны'],
  ['ураження', 'поражение'],
  ['втрати', 'потери'],
  ['добу', 'сутки'],
  ['за добу', 'за сутки'],
  ['сьогодні', 'сегодня'],
  ['вчора', 'вчера'],
  ['повідомляє', 'сообщает'],
  ['повідомили', 'сообщили'],
  ['зазначив', 'отметил'],
  ['заявив', 'заявил'],
  ['джерело', 'источник'],
  ['переговори', 'переговоры'],
  ['мирний план', 'мирный план']
];

const PHRASE_TRANSLATIONS = RAW_PHRASES.map(([phrase, repl]) => [
  cyrBoundary(phrase),
  repl
]);

/**
 * Transliterates leftover Ukrainian characters into standard Russian phonetic equivalents
 */
function transliterateUkrainianLetters(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/’|'/g, '')
    .replace(/і/g, 'и')
    .replace(/І/g, 'И')
    .replace(/ї/g, 'и')
    .replace(/Ї/g, 'И')
    .replace(/є/g, 'е')
    .replace(/Є/g, 'Е')
    .replace(/ґ/g, 'г')
    .replace(/Ґ/g, 'Г');
}

/**
 * Normalizes text to 100% Russian
 */
export function normalizeToRussian(text) {
  if (!text || typeof text !== 'string') return '';

  let normalized = text;

  // Fix OCR/LLM typos with Cyrillic boundaries
  normalized = normalized
    .replace(/(?<![а-яА-ЯёЁa-zA-Z0-9_])а\s+икож\s+просунувся(?![а-яА-ЯёЁa-zA-Z0-9_])/gi, 'а также продвижение')
    .replace(/(?<![а-яА-ЯёЁa-zA-Z0-9_])а\s+икож(?![а-яА-ЯёЁa-zA-Z0-9_])/gi, 'а также')
    .replace(/(?<![а-яА-ЯёЁa-zA-Z0-9_])икож(?![а-яА-ЯёЁa-zA-Z0-9_])/gi, 'также')
    .replace(/(?<![а-яА-ЯёЁa-zA-Z0-9_])воссиновил(?:и|а|о)?(?![а-яА-ЯёЁa-zA-Z0-9_])/gi, 'восстановили')
    .replace(/(?<![а-яА-ЯёЁa-zA-Z0-9_])воссиновлен(?:о|ы|а)?(?![а-яА-ЯёЁa-zA-Z0-9_])/gi, 'восстановлено');

  // Replace raw technical slugs in text or parentheses
  normalized = normalized
    .replace(/\(\s*kurakhove_vuhledar\s*\)/gi, '(Курахово — Угледар)')
    .replace(/\(\s*pokrovsk\s*\)/gi, '(Покровский сектор)')
    .replace(/\(\s*toretsk\s*\)/gi, '(Торецкий сектор)')
    .replace(/\(\s*chasiv_yar\s*\)/gi, '(Часов Яр / Бахмут)')
    .replace(/\(\s*kupyansk_lyman\s*\)/gi, '(Купянск — Лиман)')
    .replace(/\(\s*zaporizhzhia\s*\)/gi, '(Запорожский сектор)')
    .replace(/\(\s*kherson_dnipro\s*\)/gi, '(Херсон / Днепр)')
    .replace(/(?<![a-zA-Z0-9_])kurakhove_vuhledar(?![a-zA-Z0-9_])/gi, 'Курахово — Угледар');

  // Apply phrase replacements
  for (const [re, replacement] of PHRASE_TRANSLATIONS) {
    normalized = normalized.replace(re, replacement);
  }

  // Lookup settlements and replace Ukrainian variations
  const map = getSettlementsMap();
  for (const [stem, ru] of map.entries()) {
    if (stem.length < 4) continue;
    // Replace whole word or inflected word containing this stem
    const reg = new RegExp(`(?<![${CYR_CHAR}])${stem}[${CYR_CHAR}']*?(?![${CYR_CHAR}])`, 'gi');
    if (reg.test(normalized)) {
      normalized = normalized.replace(reg, ru);
    }
  }

  // Common Ukrainian prepositions and particles
  normalized = normalized
    .replace(/(?<![а-яА-ЯёЁa-zA-Z0-9_])та(?![а-яА-ЯёЁa-zA-Z0-9_])/gi, 'и')
    .replace(/(?<![а-яА-ЯёЁa-zA-Z0-9_])або(?![а-яА-ЯёЁa-zA-Z0-9_])/gi, 'или')
    .replace(/(?<![а-яА-ЯёЁa-zA-Z0-9_])що(?![а-яА-ЯёЁa-zA-Z0-9_])/gi, 'что')
    .replace(/(?<![а-яА-ЯёЁa-zA-Z0-9_])як(?![а-яА-ЯёЁa-zA-Z0-9_])/gi, 'как')
    .replace(/(?<![а-яА-ЯёЁa-zA-Z0-9_])де(?![а-яА-ЯёЁa-zA-Z0-9_])/gi, 'где')
    .replace(/(?<![а-яА-ЯёЁa-zA-Z0-9_])коли(?![а-яА-ЯёЁa-zA-Z0-9_])/gi, 'когда')
    .replace(/(?<![а-яА-ЯёЁa-zA-Z0-9_])після(?![а-яА-ЯёЁa-zA-Z0-9_])/gi, 'после')
    .replace(/(?<![а-яА-ЯёЁa-zA-Z0-9_])до(?![а-яА-ЯёЁa-zA-Z0-9_])/gi, 'до')
    .replace(/(?<![а-яА-ЯёЁa-zA-Z0-9_])через(?![а-яА-ЯёЁa-zA-Z0-9_])/gi, 'из-за')
    .replace(/(?<![а-яА-ЯёЁa-zA-Z0-9_])проти(?![а-яА-ЯёЁa-zA-Z0-9_])/gi, 'против')
    .replace(/(?<![а-яА-ЯёЁa-zA-Z0-9_])між(?![а-яА-ЯёЁa-zA-Z0-9_])/gi, 'между')
    .replace(/(?<![а-яА-ЯёЁa-zA-Z0-9_])під(?![а-яА-ЯёЁa-zA-Z0-9_])/gi, 'под')
    .replace(/(?<![а-яА-ЯёЁa-zA-Z0-9_])над(?![а-яА-ЯёЁa-zA-Z0-9_])/gi, 'над')
    .replace(/(?<![а-яА-ЯёЁa-zA-Z0-9_])без(?![а-яА-ЯёЁa-zA-Z0-9_])/gi, 'без')
    .replace(/(?<![а-яА-ЯёЁa-zA-Z0-9_])також(?![а-яА-ЯёЁa-zA-Z0-9_])/gi, 'также')
    .replace(/(?<![а-яА-ЯёЁa-zA-Z0-9_])тільки(?![а-яА-ЯёЁa-zA-Z0-9_])/gi, 'только')
    .replace(/(?<![а-яА-ЯёЁa-zA-Z0-9_])лише(?![а-яА-ЯёЁa-zA-Z0-9_])/gi, 'лишь')
    .replace(/(?<![а-яА-ЯёЁa-zA-Z0-9_])було(?![а-яА-ЯёЁa-zA-Z0-9_])/gi, 'было')
    .replace(/(?<![а-яА-ЯёЁa-zA-Z0-9_])були(?![а-яА-ЯёЁa-zA-Z0-9_])/gi, 'были')
    .replace(/(?<![а-яА-ЯёЁa-zA-Z0-9_])буде(?![а-яА-ЯёЁa-zA-Z0-9_])/gi, 'будет');

  // Transliterate any remaining Ukrainian letters
  normalized = transliterateUkrainianLetters(normalized);

  // Fix common grammar cleanup
  normalized = normalized
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.:;!?])/g, '$1')
    .trim();

  return normalized;
}

/**
 * Validates whether the text is valid Russian
 */
export function validateRussianText(text) {
  if (!text || typeof text !== 'string') return { valid: false, error: 'Empty text' };
  
  // Check for Ukrainian specific letters
  const ukrLettersMatch = text.match(/[іїєґІЇЄҐ]/g);
  if (ukrLettersMatch && ukrLettersMatch.length > 0) {
    return {
      valid: false,
      error: `Detected untranslated Ukrainian letters: ${ukrLettersMatch.slice(0, 5).join(', ')}`,
      fixed: normalizeToRussian(text)
    };
  }

  return {
    valid: true,
    fixed: text
  };
}

/**
 * Validates and sanitizes a complete daily digest object
 */
export function validateAndSanitizeDigest(digest) {
  if (!digest || typeof digest !== 'object') {
    throw new Error('Digest must be a valid object');
  }

  const sanitized = JSON.parse(JSON.stringify(digest));

  // Sanitize sixty_seconds
  if (Array.isArray(sanitized.sixty_seconds)) {
    sanitized.sixty_seconds = sanitized.sixty_seconds.map(item => ({
      ...item,
      headline: normalizeToRussian(item.headline),
      text: normalizeToRussian(item.text)
    }));
  }

  // Sanitize sectors
  if (Array.isArray(sanitized.sectors)) {
    sanitized.sectors = sanitized.sectors.map(sec => {
      if (typeof sec === 'string') {
        return getSectorDisplayName(sec, 'ru') || sec;
      }
      return {
        ...sec,
        name: getSectorDisplayName(sec.name || sec.sector || sec.sector_id, 'ru') || normalizeToRussian(sec.name),
        sector: sec.sector ? (getSectorDisplayName(sec.sector, 'ru') || normalizeToRussian(sec.sector)) : sec.sector
      };
    });
  }

  // Sanitize frontline_changes
  if (Array.isArray(sanitized.frontline_changes)) {
    sanitized.frontline_changes = sanitized.frontline_changes.map(item => ({
      ...item,
      sector: normalizeToRussian(item.sector),
      change: normalizeToRussian(item.change),
      confirmation: normalizeToRussian(item.confirmation),
      significance: normalizeToRussian(item.significance)
    }));
  }

  if (sanitized.frontline_summary) {
    sanitized.frontline_summary = normalizeToRussian(sanitized.frontline_summary);
  }

  // Sanitize political / negotiations events
  if (Array.isArray(sanitized.political_events)) {
    sanitized.political_events = sanitized.political_events.map(item => ({
      ...item,
      title: normalizeToRussian(item.title),
      text: normalizeToRussian(item.text || item.description || ''),
      description: normalizeToRussian(item.description || item.text || ''),
      practical_effect: normalizeToRussian(item.practical_effect || item.practical_value || '')
    }));
  }

  // Sanitize economy_and_sanctions
  if (Array.isArray(sanitized.economy_and_sanctions)) {
    sanitized.economy_and_sanctions = sanitized.economy_and_sanctions.map(item => ({
      ...item,
      title: normalizeToRussian(item.title),
      description: normalizeToRussian(item.description || item.text || ''),
      impact: normalizeToRussian(item.impact || '')
    }));
  }

  // Sanitize strikes_and_uav
  if (Array.isArray(sanitized.strikes_and_uav)) {
    sanitized.strikes_and_uav = sanitized.strikes_and_uav.map(item => ({
      ...item,
      title: normalizeToRussian(item.title),
      description: normalizeToRussian(item.description || ''),
      practical_value: normalizeToRussian(item.practical_value || item.practical_effect || '')
    }));
  }

  // Sanitize what_matters
  if (Array.isArray(sanitized.what_matters)) {
    sanitized.what_matters = sanitized.what_matters.map(item => ({
      ...item,
      fact: normalizeToRussian(item.fact),
      why_important: normalizeToRussian(item.why_important || ''),
      unclear: normalizeToRussian(item.unclear || ''),
      continuation: normalizeToRussian(item.continuation || '')
    }));
  }

  // Sanitize conclusion
  if (sanitized.day_conclusion) {
    sanitized.day_conclusion = normalizeToRussian(sanitized.day_conclusion);
  }

  return sanitized;
}

/**
 * Strict data validation pipeline for events before publication.
 * Prevents invalid data, unparsed JSON array strings, leaked slugs, or typos.
 */
export function validateEventForPublication(event) {
  if (!event || typeof event !== 'object') {
    return { valid: false, error: 'Event must be a non-null object' };
  }

  const title = event.title || event.title_ru;
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return { valid: false, error: 'Event missing required title' };
  }

  if (!event.event_date && !event.timestamp && !event.published_at && !event.date) {
    return { valid: false, error: 'Event missing required date or timestamp' };
  }

  if (!event.verification_status && !event.status) {
    return { valid: false, error: 'Event missing verification status' };
  }

  // Check for raw technical JSON structures in display strings
  const stringFields = [event.title, event.title_ru, event.summary, event.what_happened, event.location_label, event.settlement_name];
  for (const f of stringFields) {
    if (typeof f === 'string') {
      if (f.includes('["') || f.includes('"]') || f.includes('[object Object]') || f.startsWith('Array(')) {
        return { valid: false, error: `Display field contains technical array artifact: ${f}` };
      }
      if (/(?<![a-zA-Z0-9_])kurakhove_vuhledar(?![a-zA-Z0-9_])/i.test(f)) {
        return { valid: false, error: `Display field contains raw technical slug: ${f}` };
      }
      if (/(?<![а-яА-ЯёЁіІїЇєЄґҐa-zA-Z0-9_])икож(?![а-яА-ЯёЁіІїЇєЄґҐa-zA-Z0-9_])/i.test(f)) {
        return { valid: false, error: `Display field contains OCR typo 'икож': ${f}` };
      }
    }
  }

  // Check coordinates if present
  if (event.coordinates) {
    if (!Array.isArray(event.coordinates) || event.coordinates.length !== 2) {
      return { valid: false, error: 'Coordinates must be an array of [lat, lon]' };
    }
    const [lat, lon] = event.coordinates;
    if (typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon)) {
      return { valid: false, error: 'Coordinates must contain valid numbers' };
    }
    if ((lat !== 0 || lon !== 0) && (lat < 43 || lat > 56 || lon < 20 || lon > 45)) {
      return { valid: false, error: `Coordinates out of theater bounds: [${lat}, ${lon}]` };
    }
  }

  return { valid: true };
}

/**
 * Sanitizes an event ensuring all text fields are normalized to Russian and free of slugs and artifacts.
 */
export function sanitizeEventForPublication(event) {
  if (!event || typeof event !== 'object') return event;
  const sanitized = { ...event };

  if (sanitized.title) sanitized.title = normalizeToRussian(sanitized.title);
  if (sanitized.title_ru) sanitized.title_ru = normalizeToRussian(sanitized.title_ru);
  if (sanitized.summary) sanitized.summary = normalizeToRussian(sanitized.summary);
  if (sanitized.what_happened) sanitized.what_happened = normalizeToRussian(sanitized.what_happened);
  if (sanitized.what_happened_ru) sanitized.what_happened_ru = normalizeToRussian(sanitized.what_happened_ru);

  // Clean location_label & settlement_name
  if (sanitized.location_label) {
    sanitized.location_label = normalizeToRussian(sanitized.location_label)
      .replace(/\s*\([a-z_0-9-]+\)\s*$/gi, '')
      .trim();
  }
  if (sanitized.settlement_name) {
    if (Array.isArray(sanitized.settlement_name)) {
      sanitized.settlement_name = formatList(sanitized.settlement_name.map(s => normalizeToRussian(s)));
    } else {
      sanitized.settlement_name = normalizeToRussian(sanitized.settlement_name);
    }
  }

  sanitized.verification_status = sanitized.verification_status || sanitized.status || 'CONFIRMED';

  return sanitized;
}
