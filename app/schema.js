/* One place that defines every record type: which fields it shows, which
   categories it offers, where it is listed, and how it affects net worth.
   Adding a life area means adding an entry here — nothing else. */

export const STATUS = {
  draft:      { ru: "Черновик",           en: "Draft",              tone: "muted"  },
  planned:    { ru: "Запланировано",      en: "Planned",            tone: "info"   },
  unverified: { ru: "Нужно подтвердить",  en: "Needs confirmation", tone: "amber"  },
  confirmed:  { ru: "Подтверждено",       en: "Confirmed",          tone: "green"  },
  active:     { ru: "Активно",            en: "Active",             tone: "green"  },
  waiting:    { ru: "Ожидает",            en: "Waiting",            tone: "info"   },
  done:       { ru: "Выполнено",          en: "Done",               tone: "green"  },
  paid:       { ru: "Оплачено",           en: "Paid",               tone: "green"  },
  overdue:    { ru: "Просрочено",         en: "Overdue",            tone: "red"    },
  closed:     { ru: "Закрыто",            en: "Closed",             tone: "muted"  },
  archived:   { ru: "В архиве",           en: "Archived",           tone: "muted"  }
};

/* Only these statuses let a record contribute to money totals. Everything else
   stays visible in lists but is excluded from arithmetic, and the UI says so. */
export const COUNTS_AS_VERIFIED = new Set(["confirmed", "active", "paid", "done"]);

export const PRIORITY = {
  high:   { ru: "Высокий", en: "High" },
  medium: { ru: "Средний", en: "Medium" },
  low:    { ru: "Низкий",  en: "Low" }
};

export const CONFIDENCE = {
  high:   { ru: "Высокая", en: "High" },
  medium: { ru: "Средняя", en: "Medium" },
  low:    { ru: "Низкая",  en: "Low" }
};

export const OWNER = {
  me:     { ru: "Я",         en: "Me" },
  spouse: { ru: "Супруга",   en: "Spouse" },
  joint:  { ru: "Совместно", en: "Joint" },
  family: { ru: "Семья",     en: "Family" }
};

export const FREQUENCY = {
  weekly:    { ru: "Еженедельно",     en: "Weekly",    perMonth: 52 / 12 },
  biweekly:  { ru: "Раз в 2 недели",  en: "Biweekly",  perMonth: 26 / 12 },
  monthly:   { ru: "Ежемесячно",      en: "Monthly",   perMonth: 1 },
  quarterly: { ru: "Ежеквартально",   en: "Quarterly", perMonth: 1 / 3 },
  annual:    { ru: "Ежегодно",        en: "Yearly",    perMonth: 1 / 12 }
};

/* How a type participates in net worth:
   asset — adds, liability — subtracts, flow — cashflow only, none — not money. */
export const BALANCE_ROLE = { ASSET: "asset", LIABILITY: "liability", FLOW: "flow", NONE: "none" };

const c = (key, ru, en) => ({ key, ru, en });

export const TYPES = {
  /* ---------- Work ---------- */
  task: {
    view: "tasks", icon: "✓", role: BALANCE_ROLE.NONE,
    title: { ru: "Задача", en: "Task" },
    plural: { ru: "Задачи", en: "Tasks" },
    /* A service, an insurance renewal, a meter reading. FREQUENCY existed in
       this file from the rebuild and nothing used it — this is what it is for. */
    fields: ["name", "category", "date", "dueTime", "frequency", "status", "priority", "owner", "reminderDate", "linked", "details"],
    statuses: ["planned", "waiting", "done", "overdue", "archived"],
    defaultStatus: "planned",
    categories: [c("personal", "Личное", "Personal"), c("finance", "Финансы", "Finance"), c("property", "Недвижимость", "Property"),
                 c("health", "Здоровье", "Health"), c("business", "Бизнес", "Business"), c("family", "Семья", "Family"), c("other", "Другое", "Other")]
  },
  project: {
    view: "projects", icon: "↗", role: BALANCE_ROLE.NONE,
    title: { ru: "Проект", en: "Project" },
    plural: { ru: "Проекты", en: "Projects" },
    fields: ["name", "category", "date", "endDate", "status", "priority", "owner", "progress", "reminderDate", "linked", "details"],
    statuses: ["planned", "active", "waiting", "done", "closed", "archived"],
    defaultStatus: "active",
    categories: [c("personal", "Личное", "Personal"), c("finance", "Финансы", "Finance"), c("property", "Недвижимость", "Property"),
                 c("business", "Бизнес", "Business"), c("health", "Здоровье", "Health"), c("other", "Другое", "Other")]
  },
  note: {
    view: "inbox", icon: "✦", role: BALANCE_ROLE.NONE,
    title: { ru: "Заметка", en: "Note" },
    plural: { ru: "Заметки", en: "Notes" },
    fields: ["name", "category", "date", "owner", "source", "linked", "details"],
    statuses: ["unverified", "confirmed", "archived"],
    defaultStatus: "unverified",
    categories: [c("idea", "Мысль", "Idea"), c("todo", "Похоже на задачу", "Looks like a task"), c("other", "Другое", "Other")]
  },

  /* ---------- Money ---------- */
  account: {
    view: "capital", icon: "◈", role: BALANCE_ROLE.ASSET,
    title: { ru: "Счёт", en: "Account" },
    plural: { ru: "Счета", en: "Accounts" },
    fields: ["name", "category", "counterparty", "amount", "currency", "date", "status", "owner", "source", "confidence", "reminderDate", "linked", "details"],
    statuses: ["unverified", "confirmed", "closed", "archived"],
    defaultStatus: "unverified", amountLabel: { ru: "Остаток", en: "Balance" },
    categories: [c("bank", "Банковский счёт", "Bank account"), c("brokerage", "Брокерский счёт", "Brokerage"),
                 c("cash", "Наличные", "Cash"), c("savings", "Накопительный", "Savings"), c("business", "Счёт бизнеса", "Business account")]
  },
  receivable: {
    view: "debts", icon: "↩", role: BALANCE_ROLE.ASSET,
    title: { ru: "Мне должны", en: "Receivable" },
    plural: { ru: "Дебиторка", en: "Receivables" },
    fields: ["name", "category", "counterparty", "amount", "currency", "date", "dueDate", "status", "priority", "terms", "file", "owner", "source", "confidence", "reminderDate", "linked", "details"],
    statuses: ["unverified", "confirmed", "waiting", "paid", "overdue", "archived"],
    defaultStatus: "unverified", requires: ["counterparty"], amountLabel: { ru: "Сумма долга", en: "Principal" },
    categories: [c("friend", "Друг / человек", "Friend"), c("car_reseller", "Перекупщик авто", "Car reseller"),
                 c("business", "Бизнес", "Business"), c("rent", "Аренда", "Rent"), c("other", "Другое", "Other")]
  },
  payable: {
    view: "debts", icon: "↪", role: BALANCE_ROLE.LIABILITY,
    title: { ru: "Я должен", en: "Payable" },
    plural: { ru: "Кредиторка", en: "Payables" },
    fields: ["name", "category", "counterparty", "amount", "currency", "date", "dueDate", "status", "priority", "terms", "file", "rate", "owner", "source", "confidence", "reminderDate", "linked", "details"],
    statuses: ["unverified", "confirmed", "active", "paid", "overdue", "archived"],
    defaultStatus: "unverified", requires: ["counterparty"], amountLabel: { ru: "Остаток долга", en: "Outstanding" },
    categories: [c("mortgage", "Ипотека", "Mortgage"), c("loan", "Кредит", "Loan"), c("person", "Человек", "Person"),
                 c("business", "Бизнес", "Business"), c("tax", "Налог", "Tax"), c("other", "Другое", "Other")]
  },
  income: {
    view: "cashflow", icon: "↑", role: BALANCE_ROLE.FLOW,
    title: { ru: "Доход", en: "Income" },
    plural: { ru: "Доходы", en: "Income" },
    fields: ["name", "category", "counterparty", "amount", "currency", "date", "status", "owner", "recurrence", "oneOff", "source", "confidence", "linked", "details"],
    statuses: ["planned", "confirmed", "archived"],
    defaultStatus: "confirmed", requires: ["amount"],
    categories: [c("salary", "Зарплата", "Salary"), c("business", "Бизнес", "Business"), c("interest", "Проценты", "Interest"),
                 c("rent", "Аренда", "Rent"), c("dividend", "Дивиденды", "Dividend"), c("sale", "Продажа", "Sale"), c("other", "Другое", "Other")]
  },
  expense: {
    view: "cashflow", icon: "↓", role: BALANCE_ROLE.FLOW,
    title: { ru: "Расход", en: "Expense" },
    plural: { ru: "Расходы", en: "Expenses" },
    fields: ["name", "category", "counterparty", "amount", "currency", "date", "status", "owner", "recurrence", "oneOff", "source", "file", "confidence", "linked", "details"],
    statuses: ["planned", "confirmed", "archived"],
    defaultStatus: "confirmed", requires: ["amount"],
    categories: [c("living", "Жизнь и продукты", "Living"), c("housing", "Жильё и ЖКХ", "Housing"), c("mortgage", "Ипотека", "Mortgage"),
                 c("transport", "Транспорт", "Transport"), c("family", "Семья", "Family"), c("health", "Здоровье", "Health"),
                 c("business", "Бизнес", "Business"), c("tax", "Налоги", "Tax"), c("subscription", "Подписки", "Subscriptions"),
                 /* Insurance is neither housing nor transport: a policy on a car, a
                    flat and a life are the same kind of spending and belong together. */
                 c("insurance", "Страховки", "Insurance"), c("education", "Обучение", "Education"),
                 c("other", "Другое", "Other")]
  },
  investment: {
    view: "investments", icon: "◇", role: BALANCE_ROLE.ASSET,
    title: { ru: "Инвестиция", en: "Investment" },
    plural: { ru: "Инвестиции", en: "Investments" },
    fields: ["name", "category", "counterparty", "amount", "costBasis", "currency", "date", "status", "priority", "terms", "file", "owner", "source", "confidence", "reminderDate", "linked", "details"],
    statuses: ["unverified", "confirmed", "active", "waiting", "closed", "archived"],
    defaultStatus: "unverified", amountLabel: { ru: "Текущая оценка", en: "Current value" },
    categories: [c("construction", "Строительный проект", "Construction"), c("jetlend", "Jetlend", "Jetlend"),
                 c("car_resale", "Сделка с перекупщиком", "Car-reseller deal"), c("brokerage", "Брокерская позиция", "Brokerage"),
                 c("business", "Инвестиция в бизнес", "Business"), c("deposit", "Вклад", "Deposit"), c("other", "Другое", "Other")]
  },
  /* A share or bond position. Separate from "investment" on purpose: an
     investment here is a stake in something — Jetlend, a business, a project —
     valued by judgement, while a security has a ticker and a public price. Two
     different things sharing one form produced a screen that could describe
     neither well. */
  security: {
    view: "investments", icon: "▤", role: BALANCE_ROLE.ASSET,
    title: { ru: "Бумага", en: "Security" },
    plural: { ru: "Бумаги", en: "Securities" },
    fields: ["name", "ticker", "market", "quantity", "costBasis", "currency", "category",
             "date", "status", "owner", "source", "confidence", "linked", "details"],
    statuses: ["unverified", "confirmed", "archived"],
    defaultStatus: "confirmed",
    categories: [c("share", "Акция", "Share"), c("bond", "Облигация", "Bond"),
                 c("etf", "Фонд / ETF", "Fund or ETF"), c("other", "Другое", "Other")]
  },
  crypto: {
    view: "crypto", icon: "₿", role: BALANCE_ROLE.ASSET, readOnly: true, valuedIn: "USD",
    title: { ru: "Криптоактив", en: "Crypto holding" },
    plural: { ru: "Крипто", en: "Crypto" },
    /* costBasis is what turns a holding into a position. Without it the app
       can say how much crypto exists and not whether owning it went well,
       which for someone who trades is the only question that matters. */
    fields: ["name", "coin", "quantity", "costBasis", "currency", "walletAddress", "category", "date", "status", "owner", "source", "confidence", "linked", "details"],
    statuses: ["unverified", "confirmed", "archived"],
    defaultStatus: "unverified",
    categories: [c("wallet", "Публичный кошелёк", "Public wallet"), c("exchange", "Биржа (только чтение)", "Exchange read-only"), c("other", "Другое", "Other")]
  },

  /* ---------- Property ---------- */
  asset: {
    view: "assets", icon: "□", role: BALANCE_ROLE.ASSET,
    title: { ru: "Актив", en: "Asset" },
    plural: { ru: "Активы", en: "Assets" },
    fields: ["name", "category", "counterparty", "amount", "costBasis", "currency", "date", "status", "ownershipPercent", "owner", "source", "file", "confidence", "reminderDate", "linked", "details"],
    statuses: ["unverified", "confirmed", "active", "closed", "archived"],
    defaultStatus: "unverified", amountLabel: { ru: "Оценка", en: "Valuation" },
    categories: [c("car", "Автомобиль", "Car"), c("land", "Земля", "Land"), c("house", "Дом", "House"),
                 c("apartment", "Квартира", "Apartment"), c("commercial", "Коммерческая", "Commercial"),
                 c("business", "Доля в бизнесе", "Business interest"), c("valuable", "Ценность", "Valuable"), c("other", "Другое", "Other")]
  },
  document: {
    view: "documents", icon: "▱", role: BALANCE_ROLE.NONE,
    title: { ru: "Документ", en: "Document" },
    plural: { ru: "Документы", en: "Documents" },
    fields: ["name", "category", "date", "expiresAt", "status", "owner", "source", "file", "reminderDate", "linked", "details"],
    statuses: ["unverified", "confirmed", "archived"],
    defaultStatus: "unverified",
    categories: [c("property", "Недвижимость", "Property"), c("finance", "Финансы", "Finance"), c("contract", "Договор", "Contract"),
                 c("identity", "Личные документы", "Identity"), c("insurance", "Страховка", "Insurance"),
                 c("medical", "Медицинский", "Medical"), c("vehicle", "Транспорт", "Vehicle"), c("other", "Другое", "Other")]
  },
  person: {
    view: "people", icon: "◎", role: BALANCE_ROLE.NONE,
    title: { ru: "Человек", en: "Person" },
    plural: { ru: "Люди", en: "People" },
    fields: ["name", "category", "counterparty", "contact", "owner", "reminderDate", "linked", "details"],
    statuses: ["active", "archived"], defaultStatus: "active",
    categories: [c("family", "Семья", "Family"), c("business", "Бизнес", "Business"), c("contractor", "Подрядчик", "Contractor"),
                 c("doctor", "Врач", "Doctor"), c("friend", "Друг", "Friend"), c("other", "Другое", "Other")]
  },

  /* ---------- Health & sport ---------- */
  health: {
    view: "labs", icon: "✚", role: BALANCE_ROLE.NONE, sensitive: true,
    title: { ru: "Запись о здоровье", en: "Health record" },
    plural: { ru: "Здоровье", en: "Health" },
    fields: ["name", "category", "date", "status", "priority", "owner", "source", "confidence", "reminderDate", "file", "linked", "details"],
    statuses: ["planned", "unverified", "confirmed", "active", "closed", "archived"],
    defaultStatus: "unverified",
    categories: [c("checkup", "Осмотр / анализы", "Check-up"), c("condition", "Состояние / диагноз", "Condition"),
                 /* Endoscopy, imaging, biopsy — a report with findings rather
                    than a row of numbers, so it needs its own home. */
                 c("procedure", "Исследование / процедура", "Procedure or imaging"),
                 c("medication", "Лекарство", "Medication"), c("routine", "Режим / привычка", "Routine"),
                 c("appointment", "Приём у врача", "Appointment"), c("vaccination", "Прививка", "Vaccination"), c("other", "Другое", "Other")]
  },
  workout: {
    view: "health", icon: "⚡", role: BALANCE_ROLE.NONE, sensitive: true,
    title: { ru: "Тренировка", en: "Workout" },
    plural: { ru: "Тренировки", en: "Workouts" },
    /* WHOOP brings load and recovery, which say how hard a session was. What
       it cannot say is whether the bench press went up — that lives in the
       sets, and without them there is no progression to see. */
    fields: ["name", "category", "date", "duration", "distance", "sets", "intensity", "feeling", "status", "owner", "source", "linked", "details"],
    statuses: ["planned", "done", "archived"], defaultStatus: "done",
    categories: [c("gym", "Зал / силовая", "Gym"), c("run", "Бег", "Run"), c("walk", "Ходьба", "Walk"),
                 c("bike", "Велосипед", "Bike"), c("swim", "Плавание", "Swim"), c("box", "Единоборства", "Combat"),
                 c("yoga", "Йога / растяжка", "Yoga"), c("sport", "Игровой спорт", "Team sport"), c("other", "Другое", "Other")]
  },
  measurement: {
    view: "health", icon: "◔", role: BALANCE_ROLE.NONE, sensitive: true,
    title: { ru: "Показатель", en: "Measurement" },
    plural: { ru: "Показатели", en: "Measurements" },
    fields: ["category", "value", "date", "status", "owner", "source", "confidence", "linked", "details"],
    statuses: ["unverified", "confirmed", "archived"], defaultStatus: "unverified",
    categories: [c("weight", "Вес", "Weight"), c("bodyfat", "Жир, %", "Body fat"), c("sleep", "Сон", "Sleep"),
                 c("hrv", "HRV", "HRV"), c("rhr", "Пульс покоя", "Resting HR"), c("recovery", "Восстановление", "Recovery"),
                 c("strain", "Нагрузка", "Strain"), c("steps", "Шаги", "Steps"), c("pressure", "Давление", "Blood pressure"), c("other", "Другое", "Other")]
  },

  lab: {
    view: "labs", icon: "⚗", role: BALANCE_ROLE.NONE, sensitive: true,
    title: { ru: "Анализ", en: "Lab result" },
    plural: { ru: "Анализы", en: "Lab results" },
    fields: ["name", "category", "value", "unit", "refLow", "refHigh", "date", "counterparty",
             "status", "file", "owner", "source", "reminderDate", "linked", "details"],
    statuses: ["unverified", "confirmed", "archived"], defaultStatus: "unverified",
    categories: [c("blood", "Общий анализ крови", "Blood count"), c("biochem", "Биохимия", "Biochemistry"),
                 c("hormones", "Гормоны", "Hormones"), c("vitamins", "Витамины и минералы", "Vitamins & minerals"),
                 c("lipids", "Липидный профиль", "Lipids"), c("urine", "Моча", "Urine"),
                 c("thyroid", "Щитовидная железа", "Thyroid"), c("markers", "Маркеры", "Markers"),
                 c("other", "Другое", "Other")]
  },

  /* ---------- Thinking ---------- */
  /* A goal is money with a deadline. It carries no balance of its own: the
     amount is what has been put aside so far, and targetMinor is where it is
     going. Deliberately BALANCE_ROLE.NONE — counting a savings goal as an
     asset on top of the account holding the money would double it. */
  goal: {
    view: "capital", icon: "◎", role: BALANCE_ROLE.NONE,
    title: { ru: "Цель", en: "Goal" },
    plural: { ru: "Цели", en: "Goals" },
    fields: ["name", "category", "amount", "targetAmount", "currency", "date", "targetDate",
             "status", "priority", "owner", "linked", "details"],
    statuses: ["active", "waiting", "done", "archived"], defaultStatus: "active",
    categories: [c("savings", "Накопить", "Save up"), c("payoff", "Закрыть долг", "Pay off a debt"),
                 c("purchase", "Крупная покупка", "Big purchase"), c("reserve", "Подушка", "Safety net"),
                 c("other", "Другое", "Other")]
  },
  decision: {
    view: "decisions", icon: "◆", role: BALANCE_ROLE.NONE,
    title: { ru: "Решение", en: "Decision" },
    plural: { ru: "Решения", en: "Decisions" },
    fields: ["name", "category", "date", "status", "priority", "owner", "reasoning", "reminderDate", "linked", "details"],
    statuses: ["draft", "active", "waiting", "closed", "archived"], defaultStatus: "draft",
    categories: [c("finance", "Финансы", "Finance"), c("property", "Недвижимость", "Property"), c("business", "Бизнес", "Business"),
                 c("health", "Здоровье", "Health"), c("family", "Семья", "Family"), c("life", "Жизнь", "Life")]
  },
  event: {
    view: "timeline", icon: "◷", role: BALANCE_ROLE.NONE,
    title: { ru: "Событие", en: "Event" },
    plural: { ru: "Таймлайн", en: "Timeline" },
    fields: ["name", "category", "date", "owner", "source", "file", "linked", "details"],
    statuses: ["confirmed", "archived"], defaultStatus: "confirmed",
    categories: [c("life", "Жизнь", "Life"), c("finance", "Финансы", "Finance"), c("property", "Недвижимость", "Property"),
                 c("health", "Здоровье", "Health"), c("business", "Бизнес", "Business"), c("other", "Другое", "Other")]
  },
  snapshot: {
    view: "capital", icon: "◉", role: BALANCE_ROLE.NONE, derived: true,
    title: { ru: "Снимок капитала", en: "Capital snapshot" },
    plural: { ru: "Снимки", en: "Snapshots" },
    fields: ["name", "date", "details"],
    statuses: ["confirmed", "archived"], defaultStatus: "confirmed",
    categories: [c("net_worth", "Чистый капитал", "Net worth")]
  }
};

export const TYPE_KEYS = Object.keys(TYPES);
export const typeDef = (type) => TYPES[type] || null;
export const viewOf = (type) => TYPES[type]?.view || "inbox";
export const categoriesOf = (type) => TYPES[type]?.categories || [];
export const statusesOf = (type) => TYPES[type]?.statuses || ["unverified", "confirmed", "archived"];
export const fieldsOf = (type) => TYPES[type]?.fields || ["name", "date", "details"];
export const isVerified = (record) => COUNTS_AS_VERIFIED.has(record?.status);
export const isLive = (record) => Boolean(record) && !record.deletedAt && record.status !== "archived";

/* Every type must resolve to a real view, or records vanish the way
   debt/"other" records used to. Run at boot; a failure is a programming bug. */
export function assertSchemaIsSound(knownViews = null) {
  const problems = [];
  for (const [key, def] of Object.entries(TYPES)) {
    if (!def.view) problems.push(`${key}: no view`);
    if (knownViews && !knownViews.includes(def.view)) problems.push(`${key}: view "${def.view}" does not exist`);
    if (!def.statuses?.includes(def.defaultStatus)) problems.push(`${key}: defaultStatus "${def.defaultStatus}" missing from statuses`);
    for (const status of def.statuses || []) if (!STATUS[status]) problems.push(`${key}: unknown status "${status}"`);
    if (!def.categories?.length) problems.push(`${key}: no categories`);
    const seen = new Set();
    for (const cat of def.categories || []) {
      if (seen.has(cat.key)) problems.push(`${key}: duplicate category "${cat.key}"`);
      seen.add(cat.key);
    }
  }
  return problems;
}
