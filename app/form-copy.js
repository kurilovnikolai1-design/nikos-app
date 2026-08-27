/* What each field is called, per record type.
 *
 * One generic label across every type produced nonsense: adding a car asked
 * for "Банк / контрагент" and suggested "Т-Банк, Игорь, Jetlend". The same
 * field means the bank on an account, the person on a debt, the laboratory on
 * a result and the location of a car — so it is named for what it holds, not
 * for the column it lives in.
 *
 * A missing entry falls back to the generic label, so adding a type never
 * breaks; it just reads blandly until it gets its own words. */

const c = (ru, en, ruHint = "", enHint = "") => ({ ru, en, ruHint, enHint });

export const FIELD_COPY = {
  /* ---------------- who or what is on the other side ---------------- */
  counterparty: {
    account:    c("Банк", "Bank", "Например: Т-Банк, Сбербанк", "e.g. Revolut, HSBC"),
    receivable: c("Кто должен", "Who owes you", "Например: Игорь, партнёр по стройке", "e.g. Igor, a business partner"),
    payable:    c("Кому должны", "Who you owe", "Например: Сбербанк, Игорь", "e.g. the bank, a friend"),
    income:     c("Источник", "Source", "Например: работодатель, клиент, арендатор", "e.g. employer, client, tenant"),
    expense:    c("Кому платили", "Paid to", "Например: магазин, подрядчик, УК", "e.g. shop, contractor, utility"),
    investment: c("Площадка или партнёр", "Platform or partner", "Например: Jetlend, брокер, партнёр", "e.g. Jetlend, a broker, a partner"),
    asset:      c("Где находится", "Where it is", "Например: гараж на Северной, ул. Ленина 12", "e.g. the garage, 12 Lenin St"),
    crypto:     c("Где хранится", "Where it is held", "Например: Ledger, биржа (только чтение)", "e.g. Ledger, exchange (read-only)"),
    person:     c("Кто это вам", "How you know them", "Например: подрядчик, врач, партнёр", "e.g. contractor, doctor, partner"),
    lab:        c("Лаборатория", "Laboratory", "Например: KDL, Инвитро, Гемотест", "e.g. Quest, Labcorp"),
    document:   c("Кто выдал", "Issued by", "Например: Росреестр, банк, страховая", "e.g. the registry, a bank, an insurer")
  },

  /* ---------------- which date is being asked for ---------------- */
  date: {
    goal:       c("Начали копить", "Started saving"),
    account:     c("Остаток на дату", "Balance as of"),
    receivable:  c("Когда одолжили", "Lent on"),
    payable:     c("Когда возник долг", "Incurred on"),
    income:      c("Когда получено", "Received on"),
    expense:     c("Когда потрачено", "Spent on"),
    investment:  c("Когда вошли", "Entered on"),
    asset:       c("Когда приобрели", "Acquired on"),
    crypto:      c("На дату", "As of"),
    document:    c("Дата документа", "Document date"),
    task:        c("Когда сделать", "Do it on"),
    project:     c("Начало", "Started"),
    health:      c("Дата", "Date"),
    workout:     c("Когда тренировались", "Trained on"),
    measurement: c("Когда измерено", "Measured on"),
    lab:         c("Дата сдачи", "Sample date"),
    decision:    c("Когда решили", "Decided on"),
    event:       c("Когда произошло", "Happened on")
  },

  /* ---------------- the money line ---------------- */
  amount: {
    goal:       c("Уже отложено", "Put aside so far", "Сколько уже есть на эту цель", "What is set aside for this"),
    account:    c("Остаток", "Balance", "Сколько сейчас на счёте", "What is on the account now"),
    receivable: c("Сколько должны вам", "Amount owed to you"),
    payable:    c("Сколько вы должны", "Amount you owe", "Остаток долга, а не изначальная сумма", "What is left, not the original sum"),
    income:     c("Сумма", "Amount"),
    expense:    c("Сумма", "Amount"),
    investment: c("Сколько стоит сейчас", "Current value", "Текущая оценка, а не вложенное", "Today's value, not what you put in"),
    asset:      c("Сколько стоит сейчас", "Current value", "Ваша оценка — точность можно уточнить позже", "Your estimate — it can be refined later"),
    crypto:     c("Оценка вручную", "Manual valuation", "Нужна только если монета не котируется автоматически", "Only needed when the coin is not priced automatically")
  },

  targetAmount: {
    goal: c("Сколько нужно", "How much is needed", "Например: 1 500 000", "e.g. 1 500 000")
  },

  targetDate: {
    goal: c("К какому сроку", "By when", "Можно оставить пустым", "Can be left empty")
  },

  costBasis: {
    investment: c("Сколько вложили", "Amount invested", "Чтобы видеть прибыль", "So profit can be shown"),
    asset:      c("Цена покупки", "Purchase price", "Чтобы видеть, как изменилась стоимость", "So the change in value can be shown")
  },

  /* ---------------- terms and free text ---------------- */
  terms: {
    receivable: c("Договорённость", "The arrangement", "Например: вернёт до 1 марта, без процентов", "e.g. back by 1 March, no interest"),
    payable:    c("Условия", "Terms", "Например: 8,4% годовых, платёж 17 числа", "e.g. 8.4% a year, payment on the 17th"),
    investment: c("Условия", "Terms", "Например: доля 30%, выход через год", "e.g. 30% share, exit after a year")
  },

  source: {
    account:     c("Откуда данные", "Where this came from", "Например: выписка банка, приложение", "e.g. bank statement, the app"),
    asset:       c("На чём основана оценка", "Basis of the valuation", "Например: объявления на Авито, оценщик", "e.g. listings, an appraiser"),
    investment:  c("Откуда данные", "Where this came from", "Например: личный кабинет, договор", "e.g. the platform, the contract"),
    lab:         c("Откуда результат", "Where the result came from", "Например: личный кабинет KDL", "e.g. the lab's portal"),
    measurement: c("Чем измерено", "Measured with", "Например: WHOOP, весы, тонометр", "e.g. WHOOP, scales, a monitor"),
    workout:     c("Откуда запись", "Where it came from", "Например: WHOOP, вручную", "e.g. WHOOP, entered by hand")
  },

  details: {
    task:        c("Контекст", "Context", "Что именно нужно сделать", "What exactly needs doing"),
    receivable:  c("Контекст", "Context", "На что давали, есть ли расписка", "What it was for, any written record"),
    payable:     c("Контекст", "Context", "На что брали, чем обеспечен", "What it was for, what secures it"),
    asset:       c("Заметка", "Note", "Госномер, кадастровый номер, состояние", "Plate, registry number, condition"),
    crypto:      c("Заметка", "Note", "Никогда не вписывайте seed-фразу или ключ", "Never write a seed phrase or key here"),
    health:      c("Что записать", "What to note", "Жалобы, назначения, самочувствие", "Symptoms, prescriptions, how you felt"),
    workout:     c("Как прошло", "How it went", "Что делали, что получилось", "What you did, how it went"),
    lab:         c("Заметка", "Note", "Комментарий лаборатории, ваши наблюдения", "The lab's comment, your own notes"),
    decision:    c("Что решаете", "What is being decided"),
    document:    c("Заметка", "Note", "Где лежит оригинал", "Where the original is kept")
  },

  status: {
    account:    c("Подтверждён?", "Confirmed?"),
    receivable: c("Состояние долга", "State of the debt"),
    payable:    c("Состояние долга", "State of the debt"),
    investment: c("Владеете или присматриваетесь?", "Owned or just watching?"),
    asset:      c("Владение подтверждено?", "Ownership confirmed?"),
    task:       c("Состояние", "State"),
    lab:        c("Подтверждено", "Confirmed")
  },

  reminderDate: {
    receivable: c("Напомнить о возврате", "Remind me about repayment"),
    payable:    c("Напомнить о платеже", "Remind me about the payment"),
    investment: c("Когда пересмотреть", "When to review"),
    decision:   c("Когда вернуться к решению", "When to revisit"),
    document:   c("Напомнить о продлении", "Remind me to renew"),
    health:     c("Напомнить", "Remind me")
  },

  /* This field says whose record it is — me, spouse, joint, family — not who
     the counterparty is. Labelling it "кому должны вернуть" on a debt made it
     read as the other party, which is a different field entirely. */
  owner: {
    account:    c("Чей счёт", "Whose account"),
    asset:      c("Чьё имущество", "Whose asset"),
    receivable: c("Чьи это деньги", "Whose money is lent"),
    payable:    c("На ком долг", "Whose debt it is"),
    income:     c("Чей доход", "Whose income"),
    expense:    c("Чей расход", "Whose spending"),
    investment: c("Чья инвестиция", "Whose investment"),
    task:       c("На кого задача", "Whose task"),
    workout:    c("Чья тренировка", "Whose workout"),
    lab:        c("Чей анализ", "Whose result")
  }
};

const pickLocale = (entry, locale) => (locale === "ru"
  ? { label: entry.ru, placeholder: entry.ruHint }
  : { label: entry.en, placeholder: entry.enHint });

/* Returns { label, placeholder } or null when this type has no special wording. */
export function fieldCopy(field, type, locale = "ru") {
  const entry = FIELD_COPY[field]?.[type];
  return entry ? pickLocale(entry, locale) : null;
}

/* The name of an asset depends on what kind of asset it is: a car is named by
   its model, an apartment by its street. Suggesting "квартира на Ленина" while
   the category says Автомобиль is the same mismatch, one level down. */
const NAME_BY_CATEGORY = {
  asset: {
    car:        ["Например: Toyota Camry 2019", "e.g. Toyota Camry 2019"],
    land:       ["Например: участок 12 соток в Отрадном", "e.g. 12 acres near the lake"],
    house:      ["Например: дом в Отрадном", "e.g. the house by the lake"],
    apartment:  ["Например: квартира на Ленина", "e.g. the flat on Lenin St"],
    commercial: ["Например: помещение на Мира, 40 м²", "e.g. the unit on Mira, 40 m²"],
    business:   ["Например: доля 30% в стройфирме", "e.g. 30% of the building firm"],
    valuable:   ["Например: часы, украшение", "e.g. a watch, jewellery"]
  },
  health: {
    procedure:  ["Например: колоноскопия, ЭГДС, УЗИ брюшной полости", "e.g. colonoscopy, gastroscopy, abdominal ultrasound"],
    condition:  ["Например: гемохроматоз", "e.g. haemochromatosis"],
    medication: ["Например: препарат и дозировка", "e.g. the drug and the dose"],
    appointment:["Например: приём у гематолога", "e.g. haematologist appointment"]
  },
  document: {
    property:  ["Например: выписка ЕГРН на участок", "e.g. title deed for the land"],
    insurance: ["Например: ОСАГО до марта", "e.g. car insurance to March"],
    identity:  ["Например: загранпаспорт", "e.g. passport"],
    vehicle:   ["Например: СТС на Camry", "e.g. vehicle registration"],
    medical:   ["Например: заключение кардиолога", "e.g. cardiologist's report"]
  },
  expense: {
    mortgage:     ["Например: платёж по ипотеке", "e.g. mortgage payment"],
    housing:      ["Например: коммунальные за август", "e.g. August utilities"],
    transport:    ["Например: бензин", "e.g. fuel"],
    subscription: ["Например: подписка на музыку", "e.g. music subscription"],
    living:       ["Например: продукты", "e.g. groceries"]
  }
};

export function namePlaceholder(type, category, locale = "ru") {
  const pair = NAME_BY_CATEGORY[type]?.[category];
  return pair ? (locale === "ru" ? pair[0] : pair[1]) : null;
}

/* Every field that carries type-specific wording, for the audit in selftest. */
export const COVERED_FIELDS = Object.keys(FIELD_COPY);
