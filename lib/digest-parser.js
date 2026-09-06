// Digest Markdown Parser for Military-Political & OSINT Daily Briefings

export function parseDigestMarkdown(rawMarkdown, date = '2026-09-05') {
  const result = {
    date,
    period: `${date}, 00:00–23:59 МСК`,
    title: 'Ежедневный военно-политический и OSINT-обзор по российско-украинскому конфликту',
    assessment: {
      balance: 'без существенного изменения баланса',
      lead: '',
      level: 'оперативно-политический',
      full_text: ''
    },
    sixty_seconds: [],
    frontline_changes: [],
    frontline_summary: '',
    strikes_and_uav: [],
    losses_and_equipment: {
      ru_claims: '',
      ua_claims: '',
      disclaimer: 'Оперативные данные сторон о потерях противника не имеют полного независимого подтверждения и могут учитывать одни и те же эпизоды по-разному.'
    },
    political_events: [],
    what_matters: [],
    watch_next: [],
    day_conclusion: '',
    sources: [],
    raw_markdown: rawMarkdown
  };

  if (!rawMarkdown || typeof rawMarkdown !== 'string') return result;

  // Extract period header e.g. **5 сентября 2026, 00:00–23:59 МСК**
  const periodMatch = rawMarkdown.match(/\*\*([0-9]{1,2}\s+[а-яА-ЯёЁ]+\s+[0-9]{4}[^\*]*)\*\*/);
  if (periodMatch) {
    result.period = periodMatch[1].trim();
  }

  // Extract Assessment line
  const assessMatch = rawMarkdown.match(/\*\*Оценка дня:\s*([^\*]+)\*\*/i);
  if (assessMatch) {
    const text = assessMatch[1].trim();
    result.assessment.full_text = `Оценка дня: ${text}`;
    if (text.includes('преимущество России')) result.assessment.balance = 'преимущество России';
    else if (text.includes('преимущество Украины')) result.assessment.balance = 'преимущество Украины';
    else result.assessment.balance = 'без существенного изменения баланса';

    const levelMatch = text.match(/Уровень:\s*([^.]+)/i);
    if (levelMatch) result.assessment.level = levelMatch[1].trim();
    result.assessment.lead = text;
  }

  // Split by markdown H2 sections
  const sections = rawMarkdown.split(/\n(?=##\s+)/);

  for (const sec of sections) {
    const trimmed = sec.trim();
    if (!trimmed.startsWith('##')) continue;

    const firstLineEnd = trimmed.indexOf('\n');
    const header = (firstLineEnd > -1 ? trimmed.slice(0, firstLineEnd) : trimmed).replace(/^##\s+/, '').trim();
    const body = firstLineEnd > -1 ? trimmed.slice(firstLineEnd).trim() : '';

    // 1. Картина дня за 60 секунд
    if (header.includes('Картина дня')) {
      const items = body.split(/\n(?=[0-9]+\.\s+\*\*)/);
      for (const it of items) {
        const m = it.match(/^[0-9]+\.\s+\*\*([^*]+)\*\*\s*([\s\S]*)/);
        if (m) {
          result.sixty_seconds.push({
            num: result.sixty_seconds.length + 1,
            headline: m[1].trim(),
            text: m[2].trim()
          });
        }
      }
    }

    // 2. Что изменилось на фронте
    else if (header.includes('Что изменилось на фронте')) {
      const parts = body.split(/\n(?=\*\*([^*]+)\*\*)/);
      // Look for sectors
      const sectorBlocks = body.split(/\n\n(?=\*\*[А-Яа-яЁёA-Za-z0-9\s—–(),.-]+\*\*)/);
      for (const block of sectorBlocks) {
        const clean = block.trim();
        if (clean.startsWith('**Итог по фронту:**')) {
          result.frontline_summary = clean.replace(/^\*\*Итог по фронту:\*\*\s*/, '').trim();
          continue;
        }

        const lines = clean.split('\n');
        const first = lines[0].replace(/^\*\*|\*\*$/g, '').trim();
        if (!first || first.startsWith('Изменение:') || first.startsWith('Подтверждение:') || first.startsWith('Значение:')) continue;

        const changeMatch = clean.match(/\*\*Изменение:\*\*\s*([^\n]+(?:\n(?!\*\*)[^\n]+)*)/);
        const evMatch = clean.match(/\*\*Подтверждение:\*\*\s*([^\n]+(?:\n(?!\*\*)[^\n]+)*)/);
        const sigMatch = clean.match(/\*\*Значение:\*\*\s*([^\n]+(?:\n(?!\*\*)[^\n]+)*)/);

        if (changeMatch || evMatch || sigMatch) {
          result.frontline_changes.push({
            sector: first,
            change: changeMatch ? changeMatch[1].trim() : '',
            evidence: evMatch ? evMatch[1].trim() : '',
            significance: sigMatch ? sigMatch[1].trim() : ''
          });
        }
      }

      if (!result.frontline_summary) {
        const sumMatch = body.match(/\*\*Итог по фронту:\*\*\s*([^\n]+(?:\n[^\n]+)*)/);
        if (sumMatch) result.frontline_summary = sumMatch[1].trim();
      }
    }

    // 3. Удары, ракеты, авиация и БПЛА
    else if (header.includes('Удары') || header.includes('БПЛА')) {
      const strikeBlocks = body.split(/\n(?=\*\*[А-Яа-яЁё0-9\s—–(),.-]+\*\*)/);
      for (const sb of strikeBlocks) {
        const cl = sb.trim();
        const headerM = cl.match(/^\*\*([^*]+)\*\*\s*([\s\S]*)/);
        if (headerM) {
          const title = headerM[1].trim();
          const rest = headerM[2].trim();
          const sigM = rest.match(/\*\*Практическое значение:\*\*\s*([\s\S]*)/);
          const practical = sigM ? sigM[1].trim() : '';
          const text = sigM ? rest.replace(/\*\*Практическое значение:\*\*[\s\S]*/, '').trim() : rest;

          result.strikes_and_uav.push({
            title,
            text,
            practical_significance: practical
          });
        }
      }
    }

    // 4. Потери и техника
    else if (header.includes('Потери')) {
      const ruMatch = body.match(/\*\*Заявления российской стороны\*\*\s*([\s\S]*?)(?=\*\*Заявления украинской стороны|\*\*Оговорка|$)/i);
      const uaMatch = body.match(/\*\*Заявления украинской стороны[^*]*\*\*\s*([\s\S]*?)(?=\*\*Оговорка|$)/i);
      const discMatch = body.match(/\*\*Оговорка:\*\*\s*([^\n]+(?:\n[^\n]+)*)/i);

      if (ruMatch) result.losses_and_equipment.ru_claims = ruMatch[1].trim();
      if (uaMatch) result.losses_and_equipment.ua_claims = uaMatch[1].trim();
      if (discMatch) result.losses_and_equipment.disclaimer = discMatch[1].trim();
    }

    // 5. Военно-политические события и переговоры
    else if (header.includes('Военно-политические события') || header.includes('Переговоры') || header.includes('Дипломатия')) {
      const polBlocks = body.split(/\n(?=\*\*[А-Яа-яЁё0-9\s—–(),.-]+\*\*)/);
      for (const pb of polBlocks) {
        const cl = pb.trim();
        const m = cl.match(/^\*\*([^*]+)\*\*\s*([\s\S]*)/);
        if (m) {
          const title = m[1].trim();
          const rest = m[2].trim();
          const effM = rest.match(/\*\*Что меняется на практике:\*\*\s*([\s\S]*)/);
          const eff = effM ? effM[1].trim() : '';
          const text = effM ? rest.replace(/\*\*Что меняется на практике:\*\*[\s\S]*/, '').trim() : rest;

          result.political_events.push({
            title,
            text,
            description: text,
            practical_effect: eff
          });
        }
      }
      if (result.political_events.length === 0 && body.length > 20) {
        result.political_events.push({
          title: 'Дипломатический трек и переговоры',
          text: body,
          description: body,
          practical_effect: 'Оценка влияния на общий ход конфликта.'
        });
      }
    }

    // 5b. Экономика, санкции и рынки
    else if (header.includes('Экономика') || header.includes('санкции') || header.includes('рынки')) {
      if (!result.economy_and_sanctions) result.economy_and_sanctions = [];
      const econBlocks = body.split(/\n(?=\*\*[А-Яа-яЁё0-9\s—–(),.-]+\*\*)/);
      for (const eb of econBlocks) {
        const cl = eb.trim();
        const m = cl.match(/^\*\*([^*]+)\*\*\s*([\s\S]*)/);
        if (m) {
          const title = m[1].trim();
          const rest = m[2].trim();
          const impM = rest.match(/\*\*Влияние:\*\*\s*([\s\S]*)/);
          const impact = impM ? impM[1].trim() : '';
          const desc = impM ? rest.replace(/\*\*Влияние:\*\*[\s\S]*/, '').trim() : rest;
          result.economy_and_sanctions.push({
            title,
            description: desc,
            impact
          });
        }
      }
      if (result.economy_and_sanctions.length === 0 && body.length > 20) {
        result.economy_and_sanctions.push({
          title: 'Макроэкономическая динамика и санкции',
          description: body,
          impact: 'Оценка устойчивости внешнеторговых цепочек и бюджета.'
        });
      }
    }

    // 6. Что действительно важно
    else if (header.includes('Что действительно важно')) {
      const wmItems = body.split(/\n(?=[0-9]+\.\s+\*\*Факт:)/);
      for (const item of wmItems) {
        const factMatch = item.match(/\*\*Факт:\*\*\s*([^\n]+(?:\n(?!\*\*)[^\n]+)*)/);
        const whyMatch = item.match(/\*\*Почему это важно:\*\*\s*([^\n]+(?:\n(?!\*\*)[^\n]+)*)/);
        const unclearMatch = item.match(/\*\*Что пока неясно:\*\*\s*([^\n]+(?:\n(?!\*\*)[^\n]+)*)/);
        const contMatch = item.match(/\*\*Вероятное продолжение:\*\*\s*([^\n]+(?:\n(?!\*\*)[^\n]+)*)/);

        if (factMatch) {
          result.what_matters.push({
            num: result.what_matters.length + 1,
            fact: factMatch[1].trim(),
            why_important: whyMatch ? whyMatch[1].trim() : '',
            unclear: unclearMatch ? unclearMatch[1].trim() : '',
            continuation: contMatch ? contMatch[1].trim() : ''
          });
        }
      }
    }

    // 7. За чем следить в ближайшие 24–72 часа
    else if (header.includes('За чем следить')) {
      const lines = body.split(/\n(?=[0-9]+\.\s+)/);
      for (const l of lines) {
        const cleanL = l.replace(/^[0-9]+\.\s+/, '').trim();
        if (cleanL) result.watch_next.push(cleanL);
      }
    }

    // 8. Итог
    else if (header.includes('Итог')) {
      result.day_conclusion = body.trim();
    }

    // 9. Источники
    else if (header.includes('Источники')) {
      const srcLines = body.split('\n');
      for (const line of srcLines) {
        const linkMatch = line.match(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)(?:\s*—\s*([^\n]+))?/);
        if (linkMatch) {
          result.sources.push({
            title: linkMatch[1].trim(),
            url: linkMatch[2].trim(),
            category: linkMatch[3] ? linkMatch[3].trim() : 'OSINT / СМИ'
          });
        }
      }
    }
  }

  return result;
}

export const SYSTEM_PROMPT_DAILY_DIGEST = `Время готовить ежедневный дайджест боевых действий. Подготовьте текст с новостями за последние 24 часа (00:00–23:59 МСК).
Ты — редактор ежедневного военно-политического и OSINT-обзора по российско-украинскому конфликту. Готовь для российского читателя 30–40 лет профессиональный и интересный дайджест за прошедшие сутки: без воды, повторов, пропагандистских штампов и пересказа новостной ленты.

## Цель
За 5–8 минут читатель должен понять:
1. Что реально изменилось за сутки.
2. Где подтверждено продвижение, отход или изменение оперативной обстановки.
3. Какие удары имели практическое значение.
4. Какие решения могут повлиять на ход конфликта.
5. Кто получил преимущество и какого уровня: тактического, оперативного или стратегического.
6. За чем следить в ближайшие 24–72 часа.

Период: [ДАТА, 00:00–23:59 МСК].
Учитывай только события этого периода либо новые сведения, существенно меняющие оценку более раннего события.

## Правила
* Пиши по-русски, ориентируясь на российского читателя, но не подменяй анализ агитацией.
* Не повторяй одну новость в разных разделах.
* Не перечисляй десятки населённых пунктов, частей и единиц техники без объяснения значения.
* Не копируй официальные сводки и Telegram-посты.
* Обычный объём: 700–1200 слов, в исключительно насыщенный день — до 1500.
* Если значимых событий мало, не заполняй объём второстепенными новостями.
* Пиши короткими абзацами. Каждый важный абзац должен отвечать: «Что из этого следует?»
* Сравнивай события с предыдущими 1–3 сутками. Старую информацию включай только при новом развитии.
* Не используй клише «сокрушительный удар», «катастрофические потери», «фронт рухнул», «перелом», «все цели поражены» без надёжных доказательств.
* Не уравнивай стороны искусственно. Устанавливай наиболее вероятную картину по совокупности данных.
* При недостатке данных прямо указывай неопределённость.

## Источники и проверка
Используй:
* официальные органы России и Украины;
* региональные власти;
* Reuters, AP, Financial Times, BBC и другие крупные СМИ;
* проверенные OSINT-проекты, геолокацию, спутниковые снимки и карты;
* военкоров и Telegram-каналы обеих сторон только как дополнительные источники.

Важное событие желательно подтверждать минимум двумя независимыми источниками.
Всегда различай:
* подтверждённый факт;
* заявление российской стороны;
* заявление украинской стороны;
* оценку OSINT;
* неподтверждённое сообщение.

Один Telegram-канал не считается подтверждением.
Изменения линии фронта признавай только при наличии геолокации, совпадающих заявлений сторон, нескольких OSINT-источников или устойчивого изменения на авторитетных картах. Не объявляй населённый пункт полностью занятым по сообщению одной стороны.
Если подтверждения нет, пиши: «Независимого подтверждения на момент подготовки обзора нет».

## Потери
* Все цифры сопровождай источником.
* Не складывай заявления разных ведомств.
* Не выводи собственную «точную» цифру.
* Разделяй заявленные и визуально подтверждённые потери.
* Учитывай двойной счёт, завышение и неполноту данных.
* Не переписывай всю суточную сводку Минобороны; выделяй только необычно крупные или оперативно значимые эпизоды.
Обязательная оговорка:
«Оперативные данные сторон о потерях противника не имеют полного независимого подтверждения и могут учитывать одни и те же эпизоды по-разному».

## Значимость
Присваивай ключевым событиям категорию:
* Стратегическое — способно изменить общий ход конфликта.
* Оперативное — влияет на крупное направление, логистику, резервы или устойчивость группировки.
* Тактическое — локальный бой, продвижение, контратака или удар.
* Информационный шум — громкое заявление без практических последствий.

# Структура отчёта
**[ДАТА, 00:00–23:59 МСК]**

## Картина дня за 60 секунд
Дай 4–6 тезисов (главное изменение, удар, решение, преимущество, динамика). Каждый тезис — 2–3 предложения.
Заверши:
**Оценка дня: преимущество России / преимущество Украины / без существенного изменения баланса. Уровень: тактический / оперативный / стратегический.**

## Что изменилось на фронте
Для каждого направления:
**[Направление / Населенные пункты]**
**Изменение:** ...
**Подтверждение:** ...
**Значение:** ...
Итог: **Итог по фронту:** ...

## Удары, ракеты, авиация и БПЛА
**[Название удара/атаки]**
...
**Практическое значение:** ...
Отдельно выдели: **Атаки на территорию России**

## Потери и техника
**Заявления российской стороны**
...
**Заявления украинской стороны**
...
**Оговорка:** Оперативные данные сторон о потерях противника не имеют полного независимого подтверждения и могут учитывать одни и те же эпизоды по-разному.

## Военно-политические события
**[Событие]**
...
**Что меняется на практике:** ...

## Что действительно важно
1. **Факт:** ...
   **Почему это важно:** ...
   **Что пока неясно:** ...
   **Вероятное продолжение:** ...
(и так 3 факта)

## За чем следить в ближайшие 24–72 часа
1. ...
2. ...
3. ...
4. ...
5. ...

## Итог
Один плотный аналитический абзац до 100 слов.

## Источники
Приведи 6–12 основных источников с активными ссылками и категориями (международное СМИ / официальный источник РФ / официальный источник Украины / OSINT).
`;
