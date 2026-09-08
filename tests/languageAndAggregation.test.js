/**
 * Automated Test Suite for Language Normalization, Settlement Aggregation & Data Pipeline
 * Covers all edge cases:
 * - Empty arrays, single element, multiple elements
 * - Deduplication of settlements
 * - null, undefined, and malformed inputs
 * - Invalid/technical slugs mapping
 * - OCR/LLM typos correction (e.g., "икож", "воссиновил")
 * - Ukrainian to Russian settlement and text normalization
 * - Publication gate validation & sanitization
 */

import assert from 'assert';
import {
  formatList,
  normalizeToRussian,
  getSectorDisplayName,
  validateRussianText,
  validateEventForPublication,
  sanitizeEventForPublication,
  validateAndSanitizeDigest,
  SLUG_TO_NAME
} from '../lib/languageValidator.js';

console.log('--- RUNNING LANGUAGE, AGGREGATION & DATA PIPELINE TESTS ---');

let passedTests = 0;
let totalTests = 0;

function testCase(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`[PASS] Test ${totalTests}: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] Test ${totalTests}: ${name}`);
    console.error(`       Error: ${err.message}`);
  }
}

// 1. Array Formatting & Edge Cases
testCase('formatList handles empty array', () => {
  assert.strictEqual(formatList([]), '');
  assert.strictEqual(formatList(null), '');
  assert.strictEqual(formatList(undefined), '');
});

testCase('formatList handles single element', () => {
  assert.strictEqual(formatList(['Покровск']), 'Покровск');
  assert.strictEqual(formatList(['  Торецк  ']), 'Торецк');
});

testCase('formatList handles two elements with conjunction', () => {
  assert.strictEqual(formatList(['Покровск', 'Торецк']), 'Покровск и Торецк');
  assert.strictEqual(formatList(['Покровск', 'Торецк'], { lang: 'en' }), 'Покровск and Торецк');
  assert.strictEqual(formatList(['Покровск', 'Торецк'], { lang: 'uk' }), 'Покровск та Торецк');
});

testCase('formatList handles three or more elements with Oxford-style / standard Russian commas', () => {
  assert.strictEqual(
    formatList(['Покровск', 'Торецк', 'Курахово']),
    'Покровск, Торецк и Курахово'
  );
  assert.strictEqual(
    formatList(['А', 'Б', 'В', 'Г']),
    'А, Б, В и Г'
  );
});

testCase('formatList deduplicates identical elements preserving order', () => {
  assert.strictEqual(
    formatList(['Торецк', 'Покровск', 'Торецк', 'покровск']),
    'Торецк и Покровск'
  );
});

testCase('formatList filters out empty, null, or undefined items', () => {
  assert.strictEqual(
    formatList(['Покровск', null, '', '   ', undefined, 'Торецк']),
    'Покровск и Торецк'
  );
});

// 2. Slug & Technical Identifier Normalization
testCase('getSectorDisplayName maps technical slugs to proper Russian names', () => {
  assert.strictEqual(getSectorDisplayName('kurakhove_vuhledar', 'ru'), 'Курахово — Угледар');
  assert.strictEqual(getSectorDisplayName('pokrovsk', 'ru'), 'Покровский сектор');
  assert.strictEqual(getSectorDisplayName('toretsk', 'ru'), 'Торецкий сектор');
  assert.strictEqual(getSectorDisplayName('chasiv_yar', 'ru'), 'Часов Яр / Бахмут');
  assert.strictEqual(getSectorDisplayName('kupyansk_lyman', 'ru'), 'Купянск — Лиман');
});

testCase('normalizeToRussian strips raw slug in parentheses and text', () => {
  const input = 'Бои в районе (kurakhove_vuhledar) на южном фланге.';
  const output = normalizeToRussian(input);
  assert.ok(!output.includes('kurakhove_vuhledar'), 'Slug must be removed');
  assert.ok(output.includes('Курахово — Угледар'), 'Russian title must be present');
});

// 3. Typo & OCR Error Correction
testCase('normalizeToRussian corrects OCR "икож" to "также"', () => {
  const input1 = 'Подтвержден переход под контроль н.п., а икож просунувся в районе.';
  const output1 = normalizeToRussian(input1);
  assert.ok(!output1.includes('икож'), 'Word икож must be eliminated');
  assert.ok(output1.includes('также'), 'Should contain также');

  const input2 = 'Было икож замечено движение техники.';
  const output2 = normalizeToRussian(input2);
  assert.ok(!output2.includes('икож'), 'Word икож must be eliminated');
  assert.ok(output2.includes('также'), 'Should contain также');
});

testCase('normalizeToRussian corrects "воссиновил" to "восстановили"', () => {
  const input = 'Подразделения воссиновили контроль над опорным пунктом.';
  const output = normalizeToRussian(input);
  assert.ok(!output.includes('воссиновил'), 'Typo must be fixed');
  assert.ok(output.includes('восстановили'), 'Must use восстановили');
});

// 4. Ukrainian Translation & Transliteration
testCase('normalizeToRussian translates Ukrainian settlement names and phrases', () => {
  const input = 'Сили Оборони України відновили контроль поблизу Никифорівки';
  const output = normalizeToRussian(input);
  assert.ok(output.includes('Силы обороны Украины'), 'Should be Russian forces name');
  assert.ok(output.includes('Никифоровк'), 'Settlement should be translated to Russian');
  assert.ok(!output.includes('Никифорівки'), 'No Ukrainian specific letters');
});

testCase('validateRussianText detects untranslated Ukrainian letters', () => {
  const ukrText = 'Тривають бої біля залізниці та станції';
  const check = validateRussianText(ukrText);
  assert.strictEqual(check.valid, false, 'Should fail validation on Ukrainian text');

  const ruText = 'Продолжаются бои около железной дороги и станции';
  const checkRu = validateRussianText(ruText);
  assert.strictEqual(checkRu.valid, true, 'Should pass on clean Russian text');
});

// 5. Data Pipeline Validation & Sanitization
testCase('validateEventForPublication rejects malformed or unverified events', () => {
  assert.strictEqual(validateEventForPublication(null).valid, false);
  assert.strictEqual(validateEventForPublication({}).valid, false);
  assert.strictEqual(validateEventForPublication({ title: 'Тест' }).valid, false);

  const goodEvent = {
    title: 'Продвижение в районе Покровска',
    event_date: '2026-09-07',
    verification_status: 'CONFIRMED',
    location: { lat: 48.28, lon: 37.18 }
  };
  assert.strictEqual(validateEventForPublication(goodEvent).valid, true);
});

testCase('sanitizeEventForPublication cleans slugs, typos, and sets sensible defaults', () => {
  const dirty = {
    title: 'Бои в районе (kurakhove_vuhledar) а икож Торецка',
    location_label: 'Никифорівки (kurakhove_vuhledar)'
  };
  const clean = sanitizeEventForPublication(dirty);
  assert.ok(!clean.title.includes('kurakhove_vuhledar'));
  assert.ok(!clean.title.includes('икож'));
  assert.ok(!clean.location_label.includes('kurakhove_vuhledar'));
  assert.ok(clean.location_label.includes('Никифоровк'));
  assert.strictEqual(clean.verification_status, 'CONFIRMED');
});

// 6. Digest Sanitization
testCase('validateAndSanitizeDigest sanitizes sixty_seconds and sectors', () => {
  const dirtyDigest = {
    report_date: '2026-09-07',
    sixty_seconds: [
      {
        num: 1,
        headline: 'Смещение ЛБС',
        text: 'Подтвержденные изменения на участках: kurakhove_vuhledar (+0.8 км²), а икож pokrovsk (+2.65 км²).'
      }
    ],
    sectors: [
      {
        sector_id: 'kurakhove_vuhledar',
        name: 'kurakhove_vuhledar'
      }
    ]
  };

  const cleanDigest = validateAndSanitizeDigest(dirtyDigest);
  assert.ok(!cleanDigest.sixty_seconds[0].text.includes('kurakhove_vuhledar'));
  assert.ok(!cleanDigest.sixty_seconds[0].text.includes('икож'));
  assert.strictEqual(cleanDigest.sectors[0].name, 'Курахово — Угледар');
});

console.log('----------------------------------------------------');
console.log(`RESULTS: ${passedTests}/${totalTests} tests passed.`);

if (passedTests === totalTests) {
  console.log('>>> ALL LANGUAGE & AGGREGATION TESTS PASSED! <<<');
  process.exit(0);
} else {
  console.error(`>>> FAILED: ${totalTests - passedTests} tests did not pass. <<<`);
  process.exit(1);
}
