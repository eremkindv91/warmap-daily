/**
 * WarMap Daily - Language Validator & Russian Normalizer
 * Ensures 100% Russian language enforcement across all summaries, titles, sectors, settlements, and digests.
 */

import fs from 'fs';
import path from 'path';

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
    ['андріївк', 'Андреевка']
  ];

  for (const [stem, ru] of commonInflexions) {
    settlementsMap.set(stem, ru);
  }

  return settlementsMap;
}

// Phrase and terminology mapping
const PHRASE_TRANSLATIONS = [
  // Armed forces & actions
  [/\bСили\s+Оборони\s+України\b/gi, 'Силы обороны Украины'],
  [/\bСил\s+Оборони\b/gi, 'Сил обороны'],
  [/\bЗбройні\s+Сили\s+України\b/gi, 'Вооруженные силы Украины'],
  [/\bЗСУ\b/gi, 'ВСУ'],
  [/\bЗС\s+РФ\b/gi, 'ВС РФ'],
  [/\bросійські\s+війська\b/gi, 'российские войска'],
  [/\bворог\b/gi, 'противник'],
  [/\bворога\b/gi, 'противника'],
  [/\bворогу\b/gi, 'противнику'],
  [/\bокупанти\b/gi, 'войска РФ'],
  [/\bпідрозділи\b/gi, 'подразделения'],
  [/\bштурмові\s+групи\b/gi, 'штурмовые группы'],
  [/\bвідновили\s+контроль\b/gi, 'восстановили контроль'],
  [/\bповернули\s+контроль\b/gi, 'вернули контроль'],
  [/\bвідновили\s+позиції\b/gi, 'восстановили позиции'],
  [/\bпросунувся\b/gi, 'продвинулся'],
  [/\bпросунулися\b/gi, 'продвинулись'],
  [/\bзафіксовано\s+просування\b/gi, 'зафиксировано продвижение'],
  [/\bокупував\b/gi, 'занял'],
  [/\bзахопив\b/gi, 'взял под контроль'],
  [/\bтривають\s+важкі\s+бої\b/gi, 'продолжаются тяжелые бои'],
  [/\bтривають\s+бої\b/gi, 'идут бои'],
  [/\bуточнено\s+лінію\s+фронту\b/gi, 'уточнена линия фронта'],
  [/\bлінія\s+зіткнення\b/gi, 'линия боевого соприкосновения'],
  [/\bсіра\s+зона\b/gi, 'серая зона'],
  [/\bнаселений\s+пункт\b/gi, 'населенный пункт'],
  [/\bнаселеного\s+пункту\b/gi, 'населенного пункта'],
  [/\bбіля\b/gi, 'около'],
  [/\bпоблизу\b/gi, 'вблизи'],
  [/\bв\s+районі\b/gi, 'в районе'],
  [/\bнапрямок\b/gi, 'направление'],
  [/\bнапрямку\b/gi, 'направлении'],
  [/\bвідбито\s+атаку\b/gi, 'отражена атака'],
  [/\bвідбито\s+атаки\b/gi, 'отражены атаки'],
  [/\bартилерійський\s+обстріл\b/gi, 'артиллерийский обстрел'],
  [/\bавіаційний\s+удар\b/gi, 'авиационный удар'],
  [/\bбезпілотник\b/gi, 'беспилотник'],
  [/\bбезпілотники\b/gi, 'беспилотники'],
  [/\bдрони\b/gi, 'дроны'],
  [/\bураження\b/gi, 'поражение'],
  [/\bвтрати\b/gi, 'потери'],
  [/\bдобу\b/gi, 'сутки'],
  [/\bза\s+добу\b/gi, 'за сутки'],
  [/\bсьогодні\b/gi, 'сегодня'],
  [/\bвчора\b/gi, 'вчера'],
  [/\bповідомляє\b/gi, 'сообщает'],
  [/\bповідомили\b/gi, 'сообщили'],
  [/\bзазначив\b/gi, 'отметил'],
  [/\bзаявив\b/gi, 'заявил'],
  [/\bджерело\b/gi, 'источник'],
  [/\bпереговори\b/gi, 'переговоры'],
  [/\bмирний\s+план\b/gi, 'мирный план']
];

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

  // Apply phrase replacements
  for (const [re, replacement] of PHRASE_TRANSLATIONS) {
    normalized = normalized.replace(re, replacement);
  }

  // Lookup settlements and replace Ukrainian variations
  const map = getSettlementsMap();
  for (const [stem, ru] of map.entries()) {
    if (stem.length < 4) continue;
    // Replace whole word or inflected word containing this stem
    const reg = new RegExp(`\\b${stem}[а-яіїєґ']*\\b`, 'gi');
    if (reg.test(normalized)) {
      normalized = normalized.replace(reg, ru);
    }
  }

  // Common Ukrainian prepositions and particles
  normalized = normalized
    .replace(/\bта\b/gi, 'и')
    .replace(/\bабо\b/gi, 'или')
    .replace(/\bщо\b/gi, 'что')
    .replace(/\bяк\b/gi, 'как')
    .replace(/\bде\b/gi, 'где')
    .replace(/\bколи\b/gi, 'когда')
    .replace(/\bпісля\b/gi, 'после')
    .replace(/\bдо\b/gi, 'до')
    .replace(/\bчерез\b/gi, 'из-за')
    .replace(/\bпроти\b/gi, 'против')
    .replace(/\bміж\b/gi, 'между')
    .replace(/\bпід\b/gi, 'под')
    .replace(/\bнад\b/gi, 'над')
    .replace(/\bбез\b/gi, 'без')
    .replace(/\bтакож\b/gi, 'также')
    .replace(/\bтільки\b/gi, 'только')
    .replace(/\bлише\b/gi, 'лишь')
    .replace(/\bбуло\b/gi, 'было')
    .replace(/\bбули\b/gi, 'были')
    .replace(/\bбуде\b/gi, 'будет');

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
