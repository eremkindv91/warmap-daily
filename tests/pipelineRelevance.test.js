/**
 * Automated Test Suite for WarMap Daily Ingestion & Relevance Pipeline
 * Covers all 10 mandatory test cases from the user specification.
 */

import assert from 'assert';
import { evaluateWarRelevance, validate_article_for_publication } from '../services/warRelevanceFilter.js';

console.log('--- RUNNING WAR RELEVANCE & SECTOR CLASSIFICATION TEST SUITE ---');

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

// Test 1: Saxon-Anhalt / AfD German elections
testCase('«Эксит-поллы отдали ультраправой АдГ победу в Саксонии-Анхальт» must be EXCLUDED with sector = null', () => {
  const article = {
    title: 'Эксит-поллы отдали ультраправой АдГ победу в Саксонии-Анхальт',
    description: 'На прошедших земельных выборах в Германии ультраправая партия показала исторический результат.'
  };
  const res = evaluateWarRelevance(article);
  assert.strictEqual(res.is_relevant, false, 'Article must not be relevant');
  assert.strictEqual(res.decision, 'EXCLUDED', 'Decision must be EXCLUDED');
  assert.strictEqual(res.sector, null, 'Sector must be null');
});

// Test 2: US DOE Hormuz oil
testCase('«Минэнерго США: поставки нефти через Ормуз остаются ниже доконфликтного уровня» must be EXCLUDED with sector = null', () => {
  const article = {
    title: 'Минэнерго США: поставки нефти через Ормуз остаются ниже доконфликтного уровня',
    description: 'Танкерные перевозки через Ормузский пролив продолжают испытывать давление из-за ситуации на Ближнем Востоке.'
  };
  const res = evaluateWarRelevance(article);
  assert.strictEqual(res.is_relevant, false, 'Article must not be relevant');
  assert.strictEqual(res.decision, 'EXCLUDED', 'Decision must be EXCLUDED');
  assert.strictEqual(res.sector, null, 'Sector must be null');
});

// Test 3: US Treasuries investment
testCase('«С начала года глобальные инвесторы вложили в гособлигации США более $150 млрд» must be EXCLUDED with sector = null', () => {
  const article = {
    title: 'С начала года глобальные инвесторы вложили в гособлигации США более $150 млрд',
    description: 'Повышенный интерес к US Treasuries обусловлен ожиданиями по монетарной политике Федеральной резервной системы.'
  };
  const res = evaluateWarRelevance(article);
  assert.strictEqual(res.is_relevant, false, 'Article must not be relevant');
  assert.strictEqual(res.decision, 'EXCLUDED', 'Decision must be EXCLUDED');
  assert.strictEqual(res.sector, null, 'Sector must be null');
});

// Test 4: Axios Witkoff & Kushner discussing Russia-Ukraine peace talks
testCase('«Axios: Уиткофф и Кушнер обсуждают переговоры Россия–Украина» must be RELEVANT, DIPLOMACY, sector = null', () => {
  const article = {
    title: 'Axios: Уиткофф и Кушнер обсуждают переговоры Россия–Украина',
    description: 'Советники Трампа готовят рамочные предложения по урегулированию конфликта между Москвой и Киевом.'
  };
  const res = evaluateWarRelevance(article);
  assert.strictEqual(res.is_relevant, true, 'Article must be relevant');
  assert.strictEqual(res.category, 'DIPLOMACY', 'Category must be DIPLOMACY');
  assert.strictEqual(res.sector, null, 'Sector must be null (no geo evidence)');
  assert.ok(res.war_relevance_score >= 0.70, 'Score must be >= 0.70');
});

// Test 5: Russian forces advance near Pokrovsk
testCase('«Российские войска продвинулись в районе Покровска» must be RELEVANT, FRONTLINE, sector = pokrovsk, conf >= 0.70', () => {
  const article = {
    title: 'Российские войска продвинулись в районе Покровска',
    description: 'Штурмовые подразделения ВС РФ зафиксировали тактическое улучшение позиций на подступах к городу.'
  };
  const res = evaluateWarRelevance(article);
  assert.strictEqual(res.is_relevant, true, 'Article must be relevant');
  assert.strictEqual(res.category, 'FRONTLINE', 'Category must be FRONTLINE');
  assert.strictEqual(res.sector, 'pokrovsk', 'Sector must be pokrovsk');
  assert.ok(res.location_confidence >= 0.70, 'Location confidence must be >= 0.70');
});

// Test 6: Combat continues in region without specific geography -> sector MUST be null
testCase('«В регионе продолжаются боевые действия» must NOT get Pokrovsk or any default sector', () => {
  const article = {
    title: 'В регионе продолжаются боевые действия',
    description: 'Артиллерийские дуэли и столкновения передовых отрядов фиксируются вдоль рубежей.'
  };
  const res = evaluateWarRelevance(article);
  assert.strictEqual(res.sector, null, 'Sector MUST be null when no specific town or front is named');
  assert.notStrictEqual(res.sector, 'pokrovsk', 'CRITICAL: Must NEVER fallback to pokrovsk');
});

// Test 7: News mentioning USA without war connection
testCase('News mentioning USA without war must be EXCLUDED', () => {
  const article = {
    title: 'В США вооруженный мужчина попытался напасть на кандидата в губернаторы',
    description: 'Инцидент произошел во время предвыборного митинга в штате Пенсильвания.'
  };
  const res = evaluateWarRelevance(article);
  assert.strictEqual(res.is_relevant, false, 'Article must be excluded');
  assert.strictEqual(res.sector, null, 'Sector must be null');
});

// Test 8: News mentioning Russia stock market without war connection
testCase('News mentioning Russia stock market must be EXCLUDED', () => {
  const article = {
    title: 'Индекс Мосбиржи вырос на 1.5% на открытии торгов',
    description: 'Российский фондовый рынок показал умеренный рост на фоне дивидендных ожиданий в банковском секторе.'
  };
  const res = evaluateWarRelevance(article);
  assert.strictEqual(res.is_relevant, false, 'Article must be excluded');
  assert.strictEqual(res.sector, null, 'Sector must be null');
});

// Test 9: News about sanctions without explicit war connection
testCase('News about non-war sanctions must be EXCLUDED / LOW_RELEVANCE', () => {
  const article = {
    title: 'США ввели санкции против контрабандистов в Южной Америке, упомянув танкеры',
    description: 'Министерство финансов США расширило санкционные списки по борьбе с нелегальным оборотом в Карибском бассейне.'
  };
  const res = evaluateWarRelevance(article);
  assert.strictEqual(res.is_relevant, false, 'Must be excluded or low relevance');
  assert.strictEqual(res.sector, null, 'Sector must be null');
});

// Test 10: Military aid to Ukraine
testCase('News about military aid to Ukraine must be RELEVANT, category = MILITARY_AID, sector = null', () => {
  const article = {
    title: 'Германия передала Украине новый пакет военной помощи с боеприпасами для Patriot',
    description: 'Правительство ФРГ обновило перечень переданного Киеву вооружения, включая ракеты для систем ПВО и артиллерийские снаряды.'
  };
  const res = evaluateWarRelevance(article);
  assert.strictEqual(res.is_relevant, true, 'Article must be relevant');
  assert.strictEqual(res.category, 'MILITARY_AID', 'Category must be MILITARY_AID');
  assert.strictEqual(res.sector, null, 'Sector must be null (no frontline sector for aid)');
  assert.ok(res.war_relevance_score >= 0.70, 'Relevance score must be >= 0.70');
});

// Test 11: Validation Gate enforcement
testCase('Publication validation gate rejects fake sector assignment', () => {
  const badArticle = {
    title: 'В регионе продолжаются боевые действия',
    description: 'Боестолкновения без географии',
    sector_id: 'pokrovsk' // illegal fallback
  };
  const gateResult = validate_article_for_publication(badArticle);
  assert.strictEqual(gateResult.valid, false, 'Gate must reject sector without geographic proof');
});

console.log('----------------------------------------------------');
console.log(`RESULTS: ${passedTests}/${totalTests} tests passed.`);

if (passedTests === totalTests) {
  console.log('>>> ALL RELEVANCE & GEOLOCATION TESTS PASSED! <<<');
  process.exit(0);
} else {
  console.error(`>>> FAILED: ${totalTests - passedTests} tests did not pass. <<<`);
  process.exit(1);
}
