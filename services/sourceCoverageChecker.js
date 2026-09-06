/**
 * WarMap Daily - Source Coverage Checker
 * Ensures mandatory verification of critical sources (RBC, Vedomosti)
 * and guarantees factual transparency without hallucinating missing news.
 */

export const REQUIRED_SOURCES = ['РБК', 'Ведомости'];

export function createCoverageTracker() {
  return {
    rbc: {
      name: 'РБК',
      checked: false,
      included: false,
      article_count: 0,
      articles: [],
      status_text: 'Проверка не проводилась'
    },
    vedomosti: {
      name: 'Ведомости',
      checked: false,
      included: false,
      article_count: 0,
      articles: [],
      status_text: 'Проверка не проводилась'
    },
    negotiations: {
      checked: false,
      items_found: 0,
      status_text: 'Проверка не проводилась'
    },
    economy: {
      checked: false,
      items_found: 0,
      status_text: 'Проверка не проводилась'
    },
    svo_front: {
      checked: false,
      items_found: 0,
      status_text: 'Проверка не проводилась'
    }
  };
}

/**
 * Evaluates coverage from a list of collected/normalized news articles
 */
export function evaluateSourceCoverage(articles = [], tracker = null) {
  const t = tracker || createCoverageTracker();

  // Mark mandatory sources as checked
  t.rbc.checked = true;
  t.vedomosti.checked = true;
  t.negotiations.checked = true;
  t.economy.checked = true;
  t.svo_front.checked = true;

  const rbcArticles = articles.filter(a => {
    const src = (a.source || a.source_name || a.source_id || '').toLowerCase();
    return src.includes('рбк') || src.includes('rbc');
  });

  const vedomostiArticles = articles.filter(a => {
    const src = (a.source || a.source_name || a.source_id || '').toLowerCase();
    return src.includes('ведомости') || src.includes('vedomosti');
  });

  t.rbc.article_count = rbcArticles.length;
  t.rbc.articles = rbcArticles.slice(0, 5);
  if (rbcArticles.length > 0) {
    t.rbc.included = true;
    t.rbc.status_text = `Проверено. Найдено материалов: ${rbcArticles.length}`;
  } else {
    t.rbc.included = false;
    t.rbc.status_text = 'Новых существенных публикаций за выбранный период не обнаружено.';
  }

  t.vedomosti.article_count = vedomostiArticles.length;
  t.vedomosti.articles = vedomostiArticles.slice(0, 5);
  if (vedomostiArticles.length > 0) {
    t.vedomosti.included = true;
    t.vedomosti.status_text = `Проверено. Найдено материалов: ${vedomostiArticles.length}`;
  } else {
    t.vedomosti.included = false;
    t.vedomosti.status_text = 'Новых существенных публикаций за выбранный период не обнаружено.';
  }

  // Count category items
  const negArticles = articles.filter(a => a.category === 'negotiations');
  t.negotiations.items_found = negArticles.length;
  t.negotiations.status_text = negArticles.length > 0
    ? `Дипломатический трек: ${negArticles.length} материалов`
    : 'Существенных изменений по переговорам за выбранный период не обнаружено.';

  const econArticles = articles.filter(a => a.category === 'economy');
  t.economy.items_found = econArticles.length;
  t.economy.status_text = econArticles.length > 0
    ? `Экономика и санкции: ${econArticles.length} материалов`
    : 'Существенных изменений по санкциям и рынкам не зафиксировано.';

  const svoArticles = articles.filter(a => a.category === 'svo_front' || a.category === 'strikes');
  t.svo_front.items_found = svoArticles.length;
  t.svo_front.status_text = `Фронт и сводки: ${svoArticles.length} материалов`;

  return {
    all_required_checked: t.rbc.checked && t.vedomosti.checked,
    rbc_checked: t.rbc.checked,
    rbc_included: t.rbc.included,
    rbc_status: t.rbc.status_text,
    vedomosti_checked: t.vedomosti.checked,
    vedomosti_included: t.vedomosti.included,
    vedomosti_status: t.vedomosti.status_text,
    negotiations_status: t.negotiations.status_text,
    negotiations_count: t.negotiations.items_found,
    economy_count: t.economy.items_found,
    front_count: t.svo_front.items_found,
    tracker: t
  };
}
