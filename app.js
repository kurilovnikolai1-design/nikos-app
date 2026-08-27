const navItems = document.querySelectorAll(".nav-item[data-view]");
const pages = document.querySelectorAll(".page-view");
const breadcrumbLabel = document.getElementById("breadcrumbLabel");
const sidebar = document.getElementById("sidebar");
const toast = document.getElementById("toast");
const themeToggle = document.getElementById("themeToggle");
let locale = "ru";

function applyTheme(theme) {
  const isLight = theme === "light";
  document.body.dataset.theme = isLight ? "light" : "dark";
  if (themeToggle) {
    themeToggle.querySelector(".theme-icon").textContent = isLight ? "☾" : "☼";
    themeToggle.querySelector(".theme-label").textContent = locale === "ru" ? (isLight ? "Тёмный" : "Светлый") : (isLight ? "Dark" : "Light");
    themeToggle.setAttribute("aria-label", locale === "ru" ? (isLight ? "Переключить на тёмную тему" : "Переключить на светлую тему") : (isLight ? "Switch to dark mode" : "Switch to light mode"));
  }
}

try { applyTheme(localStorage.getItem("nikos-theme") || "dark"); } catch { applyTheme("dark"); }
themeToggle?.addEventListener("click", () => {
  const nextTheme = document.body.dataset.theme === "light" ? "dark" : "light";
  applyTheme(nextTheme);
  try { localStorage.setItem("nikos-theme", nextTheme); } catch { /* Persistence is optional in file previews. */ }
  showToast(nextTheme === "light" ? (locale === "ru" ? "Светлая тема включена." : "Light mode enabled.") : (locale === "ru" ? "Тема Nocturne включена." : "Nocturne mode enabled."));
});

const viewLabels = {
  command: { en: "Command Center", ru: "Центр управления" }, inbox: { en: "AI Inbox", ru: "AI Inbox" },
  tasks: { en: "Tasks", ru: "Задачи" }, projects: { en: "Projects", ru: "Проекты" }, capital: { en: "Capital", ru: "Капитал" }, debts: { en: "Debts", ru: "Долги" }, cashflow: { en: "Cashflow", ru: "Денежный поток" },
  investments: { en: "Investments", ru: "Инвестиции" }, crypto: { en: "Crypto", ru: "Крипто" }, assets: { en: "Assets", ru: "Активы" },
  documents: { en: "Documents", ru: "Документы" }, health: { en: "Health", ru: "Здоровье" }, people: { en: "People", ru: "Люди" }, decisions: { en: "Decisions", ru: "Решения" },
  timeline: { en: "Timeline", ru: "Таймлайн" }, settings: { en: "Settings", ru: "Настройки" }
};

const ru = {
  "Overview": "Обзор", "Private workspace": "Приватное рабочее пространство", "Owner view": "Вид владельца", "Workspace options": "Настройки рабочего пространства",
  "Command Center": "Центр управления", "Tasks": "Задачи", "Projects": "Проекты", "Investments": "Инвестиции", "Crypto": "Крипто", "Assets": "Активы", "Health": "Здоровье", "Documents": "Документы", "People": "Люди", "Decisions": "Решения", "Timeline": "Таймлайн", "Notifications": "Уведомления",
  "Capital": "Капитал", "Debts": "Долги", "Cashflow": "Денежный поток", "Life": "Жизнь", "read-only": "только чтение", "Settings": "Настройки", "Private by default": "Приватность по умолчанию",
  "Workspace": "Рабочее пространство", "Search anything": "Поиск по Nik'Os", "Notifications": "Уведомления", "Light": "Светлый", "Dark": "Тёмный",
  "WEDNESDAY · 26 AUGUST 2026": "СРЕДА · 26 АВГУСТА 2026", "Good morning": "Доброе утро", "A clear view of what matters now.": "Ясный взгляд на главное.",
  "Quick Add": "Быстро добавить", "Live signal": "Живой сигнал", "3 items need your attention": "3 пункта требуют внимания", "Open attention →": "Открыть внимание →",
  "TODAY": "СЕГОДНЯ", "Keep the day moving": "Держим день в движении", "Review the open decisions": "Пересмотреть открытые решения", "Decisions · 25 min": "Решения · 25 мин",
  "Follow up on the property documents": "Уточнить статус документов на недвижимость", "Land project · 15 min": "Земельный проект · 15 мин", "Training session": "Тренировка", "Health · 45 min": "Здоровье · 45 мин",
  "0 of 3 complete": "0 из 3 выполнено", "View all tasks →": "Все задачи →", "ATTENTION": "ВНИМАНИЕ", "Signals worth a look": "Сигналы, на которые стоит взглянуть",
  "Decision review is due": "Настало время пересмотреть решение", "Private investment · today": "Частная инвестиция · сегодня", "2 documents need renewal": "2 документа требуют продления",
  "Next 30 days · vault": "Следующие 30 дней · хранилище", "Crypto snapshot is stale": "Снимок криптоактивов устарел", "Last sync · 26 hours ago": "Последняя синхронизация · 26 часов назад",
  "Ranked by impact + time": "Отсортировано по влиянию и срокам", "Manage →": "Управлять →", "CAPITAL SNAPSHOT": "СНИМОК КАПИТАЛА", "Net worth": "Чистый капитал",
  "As of today · USD": "На сегодня · USD", "Add your first snapshot": "Добавьте первый снимок", "No personal balances are loaded. Your data stays yours.": "Личные балансы не загружены. Ваши данные остаются у вас.",
  "Liquid": "Ликвидные", "Invested": "Инвестировано", "Property": "Недвижимость", "Awaiting verified data": "Ожидаются подтверждённые данные", "Open capital →": "Открыть капитал →",
  "ACTIVE PROJECTS": "АКТИВНЫЕ ПРОЕКТЫ", "What is moving": "Что движется", "Personal operating system": "Личная операционная система", "Build the first usable slice": "Собрать первый рабочий срез",
  "Property records": "Реестр недвижимости", "Waiting for documents": "Ожидаем документы", "Weekly review": "Еженедельный обзор", "Prepare Friday review": "Подготовить обзор к пятнице",
  "3 active · 1 blocked": "3 активных · 1 заблокирован", "View projects →": "Все проекты →", "RECENT ACTIVITY": "ПОСЛЕДНЯЯ АКТИВНОСТЬ", "The thread so far": "Нить событий",
  "New project created": "Создан новый проект", "Personal operating system · just now": "Личная операционная система · только что", "AI Inbox is ready": "AI Inbox готов",
  "3 proposals waiting for review": "3 предложения ждут проверки", "Workspace initialized": "Рабочее пространство создано", "Private by default · today": "Приватность по умолчанию · сегодня",
  "All activity is traceable": "Все события прослеживаются", "Open timeline →": "Открыть таймлайн →", "Put a thought somewhere useful.": "Превратите мысль во что-то полезное.",
  "Capture a note, task, decision, or anything in between. Nik'Os will suggest structure for your approval.": "Сохраните заметку, задачу, решение или любую мысль. Nik'Os предложит структуру для вашего подтверждения.",
  "Open AI Inbox": "Открыть AI Inbox", "CAPTURE → PROPOSE → CONFIRM": "ЗАПИСЬ → ПРЕДЛОЖЕНИЕ → ПОДТВЕРЖДЕНИЕ", "Your unstructured thoughts, waiting to become useful.": "Ваши неструктурированные мысли, ожидающие порядка.",
  "Capture thought": "Записать мысль", "What would you like to remember?": "Что вы хотите запомнить?", "Suggestions require your confirmation": "Предложения требуют подтверждения",
  "Create proposal →": "Создать предложение →", "REVIEW QUEUE": "ОЧЕРЕДЬ ПРОВЕРКИ", "3 proposals": "3 предложения", "needs confirmation": "нужно подтверждение", "TASK PROPOSAL": "ПРЕДЛОЖЕНИЕ ЗАДАЧИ",
  "Suggested from a recent note · Confidence 86%": "Предложено из недавней заметки · Уверенность 86%", "Confirm": "Подтвердить", "Edit": "Изменить", "NOTE PROPOSAL": "ПРЕДЛОЖЕНИЕ ЗАМЕТКИ",
  "Suggested link · Property records project": "Предложенная связь · Проект «Реестр недвижимости»", "WORK MANAGEMENT": "УПРАВЛЕНИЕ ДЕЛАМИ", "The next clear action, always visible.": "Следующее ясное действие всегда перед глазами.",
  "New task": "Новая задача", "All": "Все", "Today": "Сегодня", "Waiting": "Ожидают", "Overdue": "Просрочены", "Task": "Задача", "Area": "Раздел", "Due": "Срок", "Status": "Статус",
  "Priority": "Приоритет", "Next": "Далее", "Planned": "Запланировано", "OUTCOMES IN MOTION": "РЕЗУЛЬТАТЫ В ДВИЖЕНИИ", "A small number of things worth finishing.": "Небольшое число дел, которые стоит завершить.",
  "New project": "Новый проект", "Build the first usable slice of Nik'Os.": "Собрать первый рабочий срез Nik'Os.", "5 tasks": "5 задач", "2 people": "2 человека", "Friday": "Пятница",
  "PERSONAL CFO": "ЛИЧНЫЙ CFO", "A verified picture of what you own, owe, and move.": "Проверенная картина того, чем вы владеете, что должны и что перемещаете.", "Add account": "Добавить счёт",
  "NO VERIFIED DATA YET": "ПОКА НЕТ ПРОВЕРЕННЫХ ДАННЫХ", "Your capital view starts with one account.": "Капитальный обзор начинается с одного счёта.", "Add a manual account or import a CSV. Every value will carry a source, timestamp, and confidence level.": "Добавьте счёт вручную или импортируйте CSV. Каждое значение будет иметь источник, время и уровень уверенности.", "Add first account": "Добавить первый счёт",
  "OWNED · PROPOSED · WATCHLIST": "ВЛАДЕНИЕ · ПРЕДЛОЖЕНИЯ · НАБЛЮДЕНИЕ", "Thesis before noise. Evidence before confidence.": "Сначала тезис, потом шум. Сначала доказательства, потом уверенность.", "Add investment": "Добавить инвестицию", "Owned": "Во владении", "Proposed": "Предложенные", "Watchlist": "Наблюдение", "Review calendar": "Календарь пересмотра",
  "No investment records yet.": "Инвестиций пока нет.", "Opportunities discussed elsewhere remain unowned until you confirm them here.": "Обсуждаемые возможности не считаются вашими активами, пока вы не подтвердите их здесь.",
  "OBSERVED ONLY · NEVER CUSTODY": "ТОЛЬКО НАБЛЮДЕНИЕ · БЕЗ ХРАНЕНИЯ", "Read-only visibility into where digital assets are observed.": "Только просмотр местонахождения цифровых активов.", "Read-only by design": "Только чтение по дизайну",
  "No seeds. No private keys. No withdrawals.": "Никаких seed-фраз, приватных ключей и вывода средств.", "Nik'Os never requests or stores signing material.": "Nik'Os никогда не запрашивает и не хранит ключи подписи.", "Connect an observed source when ready.": "Подключите наблюдаемый источник, когда будете готовы.",
  "Use a public wallet address or an exchange API with read-only permissions. No trades, transfers, or custody paths exist here.": "Используйте публичный адрес кошелька или API биржи только для чтения. Здесь нет торговли, переводов и хранения средств.", "Connect read-only source": "Подключить источник только для чтения",
  "PROPERTY · VEHICLES · BUSINESS": "НЕДВИЖИМОСТЬ · АВТО · БИЗНЕС", "Everything you own, with the context around it.": "Все ваши активы и контекст вокруг них.", "Add asset": "Добавить актив", "Real estate": "Недвижимость", "No confirmed properties": "Нет подтверждённой недвижимости", "Add property →": "Добавить недвижимость →", "Vehicles & valuables": "Авто и ценности", "No confirmed assets": "Нет подтверждённых активов", "Add asset →": "Добавить актив →", "Businesses": "Бизнес", "No confirmed ownership": "Нет подтверждённого владения", "Add business →": "Добавить бизнес →",
  "THE PRIVATE VAULT": "ПРИВАТНОЕ ХРАНИЛИЩЕ", "A file is useful when it is linked to what it protects.": "Файл полезен, когда связан с тем, что он защищает.", "Upload document": "Загрузить документ", "Your vault is ready.": "Хранилище готово.", "Upload a document, link it to an entity, and let expiry dates surface before they become emergencies.": "Загрузите документ, свяжите его с сущностью и узнайте о сроках до того, как они станут проблемой.", "Upload first document": "Загрузить первый документ",
  "PEOPLE & CONTEXT": "ЛЮДИ И КОНТЕКСТ", "Keep the human thread attached to the work.": "Сохраняйте связь между людьми и делами.", "Add person": "Добавить человека", "No people added yet.": "Людей пока нет.", "Connect people to projects, assets, decisions, and next actions without turning Nik'Os into a noisy CRM.": "Связывайте людей с проектами, активами, решениями и следующими действиями — без превращения Nik'Os в шумную CRM.", "Add first person": "Добавить первого человека",
  "THESIS · RISK · REVIEW": "ТЕЗИС · РИСК · ПЕРЕСМОТР", "Make the reasoning visible before the result arrives.": "Сделайте ход мысли видимым до того, как появится результат.", "Log decision": "Записать решение", "No decision journal entries yet.": "Записей решений пока нет.", "Record context, alternatives, confidence, and a review date. Future you gets the evidence.": "Фиксируйте контекст, альтернативы, уверенность и дату пересмотра. Будущий вы получите доказательства.", "Log first decision": "Записать первое решение",
  "THE LONG VIEW": "ДОЛГИЙ ВЗГЛЯД", "A traceable record of what changed.": "Прослеживаемая история изменений.", "Add event": "Добавить событие", "Your Nik'Os timeline starts here.": "Таймлайн Nik'Os начинается здесь.", "Confirmed tasks, projects, decisions, documents, and capital snapshots will gather here over time.": "Подтверждённые задачи, проекты, решения, документы и снимки капитала будут собираться здесь со временем.",
  "CONTROL & PRIVACY": "КОНТРОЛЬ И ПРИВАТНОСТЬ", "The quiet machinery behind a trusted workspace.": "Тихая внутренняя механика надёжного рабочего пространства.", "Privacy level": "Уровень приватности", "Private by default · owner view": "Приватность по умолчанию · вид владельца", "Private": "Приватный", "Integrations": "Интеграции", "No connected sources": "Нет подключённых источников", "0 active": "0 активных", "Snapshots & audit": "Снимки и аудит", "History is always on": "История всегда включена", "Enabled": "Включено",
  "What should Nik'Os remember?": "Что Nik'Os должен запомнить?", "Write naturally. We'll turn it into a proposal you can review.": "Пишите естественно. Мы превратим это в предложение для проверки.", "Save to AI Inbox": "Сохранить в AI Inbox", "No changes happen without confirmation.": "Изменения не происходят без подтверждения."
};
Object.assign(ru, {
  "＋ New task": "＋ Новая задача", "＋ New project": "＋ Новый проект", "☷ List": "☷ Список", "▦ Calendar": "▦ Календарь", "All priorities": "Все приоритеты", "High": "Высокий", "Medium": "Средний", "Low": "Низкий", "All types": "Все типы", "Type": "Тип", "Finance": "Финансы", "Business": "Бизнес", "This week": "Эта неделя", "This month": "Этот месяц", "CURRENT WEEK": "ТЕКУЩАЯ НЕДЕЛЯ", "CURRENT MONTH": "ТЕКУЩИЙ МЕСЯЦ", "NO DATE": "БЕЗ ДАТЫ", "scheduled": "запланировано", "Task planner opened.": "Планировщик задач открыт.", "Priority": "Приоритет", "Previous period": "Предыдущий период", "Next period": "Следующий период",
  "＋ Add account": "＋ Добавить счёт", "NET WORTH": "КАПИТАЛ", "Waiting for first snapshot": "Ожидается первый снимок", "LIQUID": "ЛИКВИДНЫЕ", "0 verified accounts": "0 подтверждённых счетов", "DEBT": "ДОЛГ", "0 verified liabilities": "0 подтверждённых обязательств", "CONFIDENCE": "УВЕРЕННОСТЬ", "No source connected": "Источник не подключён", "Build a trusted snapshot": "Соберите надёжный снимок", "Add accounts": "Добавьте счета", "Cash, brokerage, debt, or property": "Наличные, брокерский счёт, долг или недвижимость", "Attach a source": "Привяжите источник", "Statement, CSV, or manual entry": "Выписка, CSV или ручной ввод", "Verify the number": "Проверьте значение", "Mark the value as confirmed": "Отметьте значение подтверждённым", "Take a snapshot": "Сделайте снимок", "Start the history of change": "Начните историю изменений", "Import CSV": "Импортировать CSV", "SETUP PATH": "ПУТЬ НАСТРОЙКИ", "RECORD RULE": "ПРАВИЛО ЗАПИСИ", "Ownership is explicit.": "Владение фиксируется явно.", "A conversation, link, or proposal never becomes an asset automatically.": "Разговор, ссылка или предложение никогда не становятся активом автоматически.", "Owned only after confirmation": "Во владении только после подтверждения", "Proposed stays separate": "Предложенное хранится отдельно", "Every thesis gets a review date": "У каждого тезиса есть дата пересмотра", "SAFETY GATE": "ПРЕДОХРАНИТЕЛЬ", "Before connecting": "Перед подключением", "Public address or read-only token only": "Только публичный адрес или токен чтения", "No signing or transaction scopes": "Без подписи и прав на транзакции", "Source can be revoked any time": "Источник можно отозвать в любой момент", "Observed balances are informational snapshots, never instructions to trade.": "Наблюдаемые балансы — это информационные снимки, а не инструкции к торговле.", "Any starter records will be labeled sample / needs confirmation until you verify ownership.": "Стартовые записи будут отмечены как sample / needs confirmation, пока вы не подтвердите владение.", "VAULT RULES": "ПРАВИЛА ХРАНИЛИЩА", "Trace every file": "Прослеживайте каждый файл", "Source and upload date attached": "Источник и дата загрузки прикреплены", "Optional expiry reminder": "Можно добавить напоминание о сроке", "Link to project, asset, or person": "Связать с проектом, активом или человеком", "RELATIONSHIP CONTEXT": "КОНТЕКСТ ОТНОШЕНИЙ", "Useful, not noisy.": "Полезно, но без шума.", "Store only the context that helps a commitment move: role, last contact, open loop, and linked work.": "Храните только контекст, который помогает делу двигаться: роль, последний контакт, открытый вопрос и связанная работа.", "Role": "Роль", "Open loop": "Открытый вопрос", "Last contact": "Последний контакт", "Linked work": "Связанная работа", "DECISION TEMPLATE": "ШАБЛОН РЕШЕНИЯ", "Leave a trail for future you.": "Оставьте след для будущего себя.", "Context": "Контекст", "What changed?": "Что изменилось?", "Alternatives": "Альтернативы", "What else was possible?": "Что ещё было возможно?", "Confidence": "Уверенность", "How sure were you?": "Насколько вы были уверены?", "Review date": "Дата пересмотра", "When should this be revisited?": "Когда к этому вернуться?", "HISTORY MODEL": "МОДЕЛЬ ИСТОРИИ", "Nothing disappears quietly.": "Ничто не исчезает бесследно.", "Snapshots capture value over time. Audit events explain who changed what, when, and from which source.": "Снимки фиксируют значения во времени. Аудит объясняет, кто, что и когда изменил, а также из какого источника.", "Every fact has provenance": "У каждого факта есть источник", "Proposed → Confirmed → Archived": "Предложено → Подтверждено → Архивировано", "NIK'OS PLEDGE": "ПРИНЦИПЫ NIK'OS", "Encrypted at rest": "Шифрование при хранении", "Owner-scoped access": "Доступ только владельцу", "Read-only finance": "Финансы только для чтения", "Visible audit trail": "Видимый аудит", "Find anything in Nik'Os": "Найти что угодно в Nik'Os", "Start typing to search the workspace.": "Начните вводить запрос по рабочему пространству.", "Add to Nik'Os": "Добавить в Nik'Os", "This record will stay private and marked as needs confirmation.": "Запись останется приватной и будет отмечена как требующая подтверждения.", "Name": "Название", "Context or note": "Контекст или заметка", "You can edit or archive it later.": "Позже запись можно изменить или архивировать.", "Save record": "Сохранить запись", "GLOBAL SEARCH": "ГЛОБАЛЬНЫЙ ПОИСК", "CONFIRM TO SAVE": "ПОДТВЕРДИТЕ СОХРАНЕНИЕ", "Search tasks, projects, people, documents…": "Искать задачи, проекты, людей, документы…", "A new account": "Новый счёт", "A new investment": "Новая инвестиция", "A new asset": "Новый актив", "A new property": "Новая недвижимость", "A new business": "Новый бизнес", "A new document": "Новый документ", "A new person": "Новый человек", "A new decision": "Новое решение", "A new timeline event": "Новое событие таймлайна", "Privacy preference": "Настройка приватности", "Integration": "Интеграция", "Record saved locally for confirmation.": "Запись сохранена локально для подтверждения.", "Global search is coming in the next slice.": "Глобальный поиск уже доступен в этой версии.", "Light mode enabled.": "Светлая тема включена.", "Nocturne mode enabled.": "Тема Nocturne включена.", "Capture and review": "Запись и проверка", "Work management": "Управление делами", "Outcomes in motion": "Результаты в движении", "Personal CFO": "Личный CFO", "Owned, proposed, watchlist": "Владение, предложения, наблюдение", "Observed only": "Только наблюдение", "Property, vehicles, business": "Недвижимость, авто, бизнес", "Private vault": "Приватное хранилище", "Relationship context": "Контекст отношений", "Thesis and review": "Тезис и пересмотр", "The long view": "Долгий взгляд", "Control and privacy": "Контроль и приватность", "Project · 18%": "Проект · 18%", "Project · waiting for documents": "Проект · ожидает документы", "Task · today": "Задача · сегодня", "RECEIVABLES · PAYABLES · LOANS": "ДЕБИТОРКА · КРЕДИТОРКА · ЗАЙМЫ", "Debts": "Долги", "See what is owed to you and what you owe, with dates and evidence.": "Видите, кто должен вам и кому должны вы, с датами и подтверждениями.", "＋ Add debt": "＋ Добавить долг", "OWED TO YOU": "ДОЛЖНЫ ВАМ", "Receivables": "Дебиторка", "No confirmed receivables yet.": "Подтверждённой дебиторки пока нет.", "People, partners, or businesses": "Люди, партнёры или компании", "Principal · due date · repayment status": "Сумма · срок · статус возврата", "＋ Add who owes you": "＋ Добавить должника", "OWED BY YOU": "ДОЛЖНЫ ВЫ", "Payables": "Кредиторка", "No confirmed liabilities yet.": "Подтверждённых обязательств пока нет.", "Banks, people, or businesses": "Банки, люди или компании", "＋ Add what you owe": "＋ Добавить свой долг", "A promise is not a balance until it has context.": "Обещание не становится балансом без контекста.", "Counterparty and direction are required": "Нужны контрагент и направление долга", "Amount, currency, due date, and evidence stay attached": "Сумма, валюта, срок и подтверждение хранятся вместе", "Disputed or informal amounts can be marked uncertain": "Спорные или неформальные суммы можно отметить как неопределённые", "Receivables and payables": "Дебиторка и кредиторка", "INCOME · EXPENSES · TRANSFERS": "ДОХОДЫ · РАСХОДЫ · ПЕРЕВОДЫ", "Cashflow": "Денежный поток", "Understand what comes in, what goes out, and what is only moving between accounts.": "Понимайте, что приходит, что уходит и что просто перемещается между счетами.", "＋ Add expense": "＋ Добавить расход", "＋ Add income": "＋ Добавить доход", "INCOME": "ДОХОДЫ", "EXPENSES": "РАСХОДЫ", "NET FLOW": "ЧИСТЫЙ ПОТОК", "PERIOD": "ПЕРИОД", "No confirmed entries": "Нет подтверждённых записей", "Waiting for a period": "Ожидается период", "Choose a review window": "Выберите период обзора", "LEDGER": "ЖУРНАЛ", "Income and expenses": "Доходы и расходы", "This month": "Этот месяц", "Add your first income or expense. Transfers between your own accounts stay separate.": "Добавьте первый доход или расход. Переводы между своими счетами останутся отдельно.", "CLEAN NUMBERS": "ЧИСТЫЕ ЦИФРЫ", "Transfers are not income.": "Переводы — это не доход.", "When money moves between your own accounts, Nik'Os links both sides so it does not inflate your cashflow or net worth.": "Когда деньги перемещаются между вашими счетами, Nik'Os связывает обе стороны, чтобы не завышать денежный поток или капитал.", "Income: salary, business, interest, rent": "Доход: зарплата, бизнес, проценты, аренда", "Expense: living, business, tax, interest": "Расход: жизнь, бизнес, налоги, проценты", "Transfer: account to account": "Перевод: со счёта на счёт", "Amount": "Сумма", "Currency": "Валюта", "Date": "Дата", "Status": "Статус", "Owner / scope": "Владелец / режим", "Optional": "Необязательно", "Needs confirmation": "Нужно подтверждение", "Confirmed": "Подтверждено", "Active": "Активно", "Waiting": "Ожидает", "Paid": "Оплачено", "Overdue": "Просрочено", "Archived": "Архивировано", "Me": "Я", "Spouse": "Супруга", "Joint": "Совместное"
});
Object.assign(ru, { "Terms / payment day": "Условия / день платежа", "Institution / counterparty": "Банк / контрагент", "Amount": "Сумма", "Currency": "Валюта", "Date": "Дата", "Status": "Статус", "Owner / scope": "Владелец / режим", "Optional": "Необязательно", "Needs confirmation": "Нужно подтверждение", "Confirmed": "Подтверждено", "Active": "Активно", "Waiting": "Ожидает", "Paid": "Оплачено", "Overdue": "Просрочено", "Archived": "Архивировано", "Me": "Я", "Spouse": "Супруга", "Joint": "Совместное" });
Object.assign(ru, { "OBSERVED SOURCES": "НАБЛЮДАЕМЫЕ ИСТОЧНИКИ", "Read-only crypto records": "Криптоисточники только для чтения", "Add a public wallet address or a read-only exchange source.": "Добавьте публичный адрес кошелька или источник биржи только для чтения." });
Object.assign(ru, { "CLOUD SYNC": "ОБЛАЧНАЯ СИНХРОНИЗАЦИЯ", "Save automatically everywhere.": "Автоматическое сохранение везде.", "Not connected": "Не подключено", "Connect your own Supabase project once. After that, records save automatically and remain scoped to your account. GitHub stores only the Nik'Os code.": "Один раз подключите свой проект Supabase. После этого записи будут сохраняться автоматически и доступны только вашему аккаунту. GitHub хранит только код Nik'Os.", "Supabase project URL": "URL проекта Supabase", "Supabase anon key": "Anon key Supabase", "Public anon key": "Публичный anon key", "Email": "Email", "Password": "Пароль", "Your Supabase password": "Пароль Supabase", "I confirm that Nik'Os may sync my records to my Supabase project.": "Я подтверждаю, что Nik'Os может синхронизировать мои записи с моим проектом Supabase.", "Connect and sync": "Подключить и синхронизировать", "Create account": "Создать аккаунт", "Sign out": "Выйти", "One-time setup: create a Supabase project, run": "Однократная настройка: создайте проект Supabase, выполните", ", then paste the URL and anon key here.": ", затем вставьте сюда URL и anon key.", "Ready to connect": "Готово к подключению", "Syncing…": "Синхронизация…", "Connected": "Подключено", "Check connection": "Проверьте подключение", "Confirm cloud sync before connecting.": "Подтвердите синхронизацию перед подключением.", "Enter the project URL, anon key, email, and password.": "Введите URL проекта, anon key, email и пароль.", "Check your email to finish account setup.": "Проверьте email для завершения регистрации.", "Check your email to finish account setup, then connect again.": "Проверьте email для завершения регистрации, затем подключитесь снова.", "Nik'Os is synced automatically.": "Nik'Os синхронизируется автоматически.", "Cloud sync failed; local copy is safe.": "Сбой облачной синхронизации; локальная копия сохранена.", "Connected, but records could not be loaded.": "Подключено, но записи не удалось загрузить.", "Signed out. Local records remain on this device.": "Вы вышли. Локальные записи остались на этом устройстве." });
Object.assign(ru, { "Take your data with you.": "Данные всегда с вами.", "Export your Nik'Os records to a JSON file and import them later in this browser. Nothing is sent anywhere.": "Экспортируйте записи Nik'Os в JSON и импортируйте их позже в этом браузере. Данные никуда не отправляются.", "Export data": "Экспортировать данные", "Import data": "Импортировать данные", "Local backup": "Локальная копия" });
Object.assign(ru, {
  "personal control room": "личная панель управления", "＋ Capture thought": "＋ Записать мысль", "Review open decisions": "Пересмотреть открытые решения", "Property documents": "Документы на недвижимость", "Today · 09:30": "Сегодня · 09:30", "Today · 11:00": "Сегодня · 11:00", "Today · 18:30": "Сегодня · 18:30", "Fri · 16:00": "Пт · 16:00", "Personal": "Личное", "Health": "Здоровье", "Friday": "Пятница", "ACTIVE · 18%": "АКТИВЕН · 18%", "WAITING · 62%": "ОЖИДАЕТ · 62%", "ACTIVE · 78%": "АКТИВЕН · 78%", "3 tasks": "3 задачи", "5 tasks": "5 задач", "2 tasks": "2 задачи", "2 people": "2 человека", "Review Friday": "Пересмотр в пятницу", "Gather a clean, verified record of property documents.": "Собрать чистый подтверждённый реестр документов на недвижимость.", "Prepare the next clear view of the week.": "Подготовить ясный обзор недели.", "Follow up on property documents": "Уточнить статус документов на недвижимость", "Prepare weekly review": "Подготовить недельный обзор", "YOUR RECORDS": "ВАШИ ЗАПИСИ", "Added projects": "Добавленные проекты", "ACCOUNTS & SOURCES": "СЧЕТА И ИСТОЧНИКИ", "Your capital records": "Ваши записи капитала", "PORTFOLIO": "ПОРТФЕЛЬ", "Your investment records": "Ваши инвестиционные записи", "REGISTER": "РЕЕСТР", "Your property and assets": "Ваша недвижимость и активы", "＋ Add": "＋ Добавить", "＋ Add investment": "＋ Добавить инвестицию", "＋ Add asset": "＋ Добавить актив", "＋ Upload document": "＋ Загрузить документ", "＋ Add person": "＋ Добавить человека", "＋ Log decision": "＋ Записать решение", "＋ Add event": "＋ Добавить событие", "On": "Включено", "Source": "Источник", "LOCAL BACKUP": "ЛОКАЛЬНАЯ КОПИЯ", "Private by default.": "Приватность по умолчанию.", "No public sharing, no hidden writes, no custody paths. Consequential actions stay behind your confirmation.": "Нет публичного доступа, скрытых записей и хранения средств. Важные действия выполняются только после вашего подтверждения.", "Category / type": "Категория / тип", "Supabase anon key": "Публичный ключ Supabase", "Anon key Supabase": "Публичный ключ Supabase", "Public anon key": "Публичный ключ Supabase", ", then paste the URL and anon key here.": ", затем вставьте сюда URL и публичный ключ.", "QA": "QA"
});
Object.assign(ru, { "Health, routines, signals": "Здоровье, режимы и сигналы", "HEALTH · ROUTINES · SIGNALS": "ЗДОРОВЬЕ · РЕЖИМЫ · СИГНАЛЫ", "Keep health context visible without turning Nik'Os into a medical system.": "Держите контекст здоровья перед глазами, не превращая Nik'Os в медицинскую систему.", "＋ Add health record": "＋ Добавить запись о здоровье", "PRIVATE HEALTH LOG": "ЛИЧНЫЙ ЖУРНАЛ ЗДОРОВЬЯ", "Your health records": "Ваши записи о здоровье", "Add a check-up, routine, medication reminder, or personal health note.": "Добавьте осмотр, привычку, напоминание о лекарстве или личную заметку о здоровье.", "BOUNDARY": "ГРАНИЦА", "Context, not diagnosis.": "Контекст, а не диагноз.", "Health records stay private and are for your own organization. Nik'Os does not replace a doctor or emergency service.": "Записи о здоровье остаются приватными и нужны для личной организации. Nik'Os не заменяет врача или экстренную помощь.", "Private by default": "Приватно по умолчанию", "Confirm important facts yourself": "Проверяйте важные факты самостоятельно", "Check-up": "Осмотр", "Condition / diagnosis": "Состояние / диагноз", "Routine": "Режим / привычка", "Medication": "Лекарство", "Fitness": "Физическая активность", "Training session": "Тренировка", "Add health record": "Добавить запись о здоровье", "No health records added yet.": "Записей о здоровье пока нет." });
Object.assign(ru, { "Health.": "Здоровье.", "SLEEP": "СОН", "RECOVERY": "ВОССТАНОВЛЕНИЕ", "WEIGHT TREND": "ДИНАМИКА ВЕСА", "TRAINING": "ТРЕНИРОВКИ", "Connect WHOOP or add a record": "Подключите WHOOP или добавьте запись", "Observed, never diagnosed": "Наблюдение, не диагноз", "Connect a smart scale later": "Подключите умные весы позже", "Sessions and load stay linked": "Сессии и нагрузка связаны", "Sleep, recovery, strain — read-only import later": "Сон, восстановление и нагрузка — позже импорт только для чтения", "Smart scales": "Умные весы", "Weight and trend snapshots — CSV or manual": "Снимки веса и динамики — CSV или вручную", "Exams & conditions": "Обследования и состояния", "Private documents and confirmed personal context": "Приватные документы и подтверждённый личный контекст", "Manual": "Вручную", "AI will surface patterns and questions for review, never make a medical diagnosis.": "AI будет показывать закономерности и вопросы для проверки, но не ставить медицинский диагноз." });
Object.assign(ru, { "Confidence": "Уверенность", "Reminder date": "Дата напоминания", "Linked record": "Связанная запись", "No link": "Без связи", "Low": "Низкая", "Medium": "Средняя", "High": "Высокая", "Source": "Источник", "Take snapshot": "Сохранить снимок", "Capital snapshot": "Снимок капитала", "No snapshots yet.": "Снимков пока нет.", "Snapshot uses confirmed records only.": "Снимок использует только подтверждённые записи.", "Add a reminder date to surface it here.": "Добавьте дату напоминания, чтобы увидеть её здесь.", "Reminder": "Напоминание", "Confidence": "Уверенность" });
const enFromRu = Object.fromEntries(Object.entries(ru).map(([english, russian]) => [russian, english]));

const placeholderCopy = {
  captureText: { en: "Try: “Review the property docs next week” or “Decide whether to keep this investment…”", ru: "Например: «Проверить документы на недвижимость на следующей неделе» или «Решить, оставлять ли эту инвестицию…»" },
  modalInput: { en: "e.g. Follow up with the contractor on Friday if the estimate is not here", ru: "Например: уточнить у подрядчика в пятницу, если смета не пришла" },
  dataTerms: { en: "e.g. 6% · day 17", ru: "Например: 6% · день 17" },
  dataCounterparty: { en: "e.g. T-Bank, Jetlend, friend, reseller", ru: "Например: Т-Банк, Jetlend, друг, перекупщик" },
  dataSource: { en: "e.g. bank statement, WHOOP CSV, manual entry", ru: "Например: выписка банка, CSV WHOOP, ручной ввод" }
};

function translatePage() {
  document.documentElement.lang = locale;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const key = node.nodeValue.trim();
    const translated = locale === "ru" ? ru[key] : enFromRu[key];
    if (!key || !translated) continue;
    node.nodeValue = node.nodeValue.replace(key, translated);
  }
  Object.entries(placeholderCopy).forEach(([id, copy]) => { const input = document.getElementById(id); if (input) input.placeholder = copy[locale]; });
  const progress = document.getElementById("taskProgress");
  if (progress) { const complete = document.querySelectorAll("#todayTasks input[type=checkbox]:checked").length; progress.textContent = locale === "ru" ? `${complete} из 3 выполнено` : `${complete} of 3 complete`; }
  const activeView = document.querySelector(".page-view.active")?.dataset.page || "command";
  breadcrumbLabel.textContent = viewLabels[activeView][locale];
  const languageToggle = document.getElementById("languageToggle");
  languageToggle.querySelector(".lang-label").textContent = locale === "ru" ? "EN" : "RU";
  languageToggle.setAttribute("aria-label", locale === "ru" ? "Переключить язык на английский" : "Switch to Russian");
  document.getElementById("notificationButton")?.setAttribute("aria-label", locale === "ru" ? "Уведомления" : "Notifications");
  document.getElementById("mobileMenu")?.setAttribute("aria-label", locale === "ru" ? "Открыть навигацию" : "Open navigation");
  document.getElementById("captureText")?.setAttribute("aria-label", locale === "ru" ? "Что Nik'Os должен запомнить?" : "What should Nik'Os remember?");
  document.getElementById("globalSearch")?.setAttribute("aria-label", locale === "ru" ? "Глобальный поиск по Nik'Os" : "Global Nik'Os search");
  document.getElementById("modalInput")?.setAttribute("aria-label", locale === "ru" ? "Быстрая запись в Nik'Os" : "Quick capture for Nik'Os");
  document.getElementById("documentPicker")?.setAttribute("aria-label", locale === "ru" ? "Выбрать документ" : "Choose a document");
  document.getElementById("backupPicker")?.setAttribute("aria-label", locale === "ru" ? "Выбрать резервную копию" : "Choose a backup file");
  document.querySelectorAll("[data-planner-task]").forEach((input) => input.setAttribute("aria-label", `${locale === "ru" ? "Выполнить задачу" : "Complete task"}: ${input.closest(".task-cell")?.querySelector("strong")?.textContent.trim() || input.dataset.plannerTask}`));
  document.querySelector(".workspace-chip .icon-button")?.setAttribute("aria-label", locale === "ru" ? "Настройки рабочего пространства" : "Workspace options");
  const fieldLabels = { dataName: ["Name", "Название"], dataCategory: ["Category / type", "Категория / тип"], dataCounterparty: ["Institution / counterparty", "Банк / контрагент"], dataAmount: ["Amount", "Сумма"], dataCurrency: ["Currency", "Валюта"], dataDate: ["Date", "Дата"], dataStatus: ["Status", "Статус"], dataPriority: ["Priority", "Приоритет"], dataTerms: ["Terms / payment day", "Условия / день платежа"], dataOwner: ["Owner / scope", "Владелец / режим"], dataDetails: ["Context or note", "Контекст или заметка"], dataSource: ["Source", "Источник"], dataConfidence: ["Confidence", "Уверенность"], dataReminder: ["Reminder date", "Дата напоминания"], dataLinkedRecord: ["Linked record", "Связанная запись"] };
  Object.entries(fieldLabels).forEach(([id, labels]) => document.getElementById(id)?.setAttribute("aria-label", locale === "ru" ? labels[1] : labels[0]));
}

try { locale = localStorage.getItem("nikos-locale") || "ru"; } catch { locale = "ru"; }
translatePage();

document.getElementById("languageToggle")?.addEventListener("click", () => {
  locale = locale === "ru" ? "en" : "ru";
  translatePage();
  refreshDynamicSurfaces();
  try { localStorage.setItem("nikos-locale", locale); } catch { /* Persistence is optional in file previews. */ }
  showToast(locale === "ru" ? "Русский язык включён." : "English enabled.");
});

function showView(view) {
  pages.forEach((page) => page.classList.toggle("active", page.dataset.page === view));
  navItems.forEach((item) => {
    const active = item.dataset.view === view;
    item.classList.toggle("active", active);
    if (active) item.setAttribute("aria-current", "page"); else item.removeAttribute("aria-current");
  });
  breadcrumbLabel.textContent = viewLabels[view]?.[locale] || viewLabels.command[locale];
  sidebar.classList.remove("open");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

navItems.forEach((item) => item.addEventListener("click", () => showView(item.dataset.view)));
document.querySelectorAll("[data-view-target]").forEach((item) => item.addEventListener("click", () => showView(item.dataset.viewTarget)));

document.getElementById("mobileMenu")?.addEventListener("click", () => sidebar.classList.toggle("open"));

let toastTimer;
function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

const taskCheckboxes = document.querySelectorAll("#todayTasks input[type=checkbox]");
const taskProgress = document.getElementById("taskProgress");
function updateTaskProgress() {
  const complete = [...taskCheckboxes].filter((checkbox) => checkbox.checked).length;
  taskProgress.textContent = locale === "ru" ? `${complete} из 3 выполнено` : `${complete} of 3 complete`;
  try { localStorage.setItem("nikos-today-tasks", JSON.stringify([...taskCheckboxes].map((checkbox) => checkbox.checked))); } catch { /* Persistence is optional. */ }
  if (complete === 3) showToast(ui("Today is clear. Nice work.", "Сегодня всё закрыто. Отлично."));
}
try { const savedTasks = JSON.parse(localStorage.getItem("nikos-today-tasks") || "[]"); taskCheckboxes.forEach((checkbox, index) => { checkbox.checked = savedTasks[index] === true; }); } catch { /* Persistence is optional. */ }
taskCheckboxes.forEach((checkbox) => checkbox.addEventListener("change", updateTaskProgress));

document.getElementById("focusAttention")?.addEventListener("click", () => {
  document.getElementById("attentionList")?.scrollIntoView({ behavior: "smooth", block: "center" });
  showToast(ui("Attention items are ranked by impact and time.", "Пункты внимания отсортированы по влиянию и срокам."));
});
document.getElementById("manageAttention")?.addEventListener("click", () => { document.getElementById("attentionList")?.scrollIntoView({ behavior: "smooth", block: "center" }); showToast(ui("Attention items are ranked by impact and time.", "Пункты внимания отсортированы по влиянию и срокам.")); });
document.querySelectorAll("[data-attention]").forEach((item) => item.addEventListener("click", () => showToast(ui("Attention item opened.", "Открыт пункт внимания."))));
document.querySelectorAll("[data-project]").forEach((item) => item.addEventListener("click", () => showToast(ui("Project opened.", "Открыт проект."))));
document.querySelectorAll(".more-button").forEach((button) => button.addEventListener("click", () => {
  const panel = button.closest(".panel");
  const target = panel?.classList.contains("today-panel") ? "tasks" : panel?.classList.contains("projects-panel") ? "projects" : panel?.classList.contains("activity-panel") ? "timeline" : "command";
  showView(target);
  showToast(ui("Detailed view opened.", "Открыт подробный раздел."));
}));

const modalBackdrop = document.getElementById("modalBackdrop");
const modalInput = document.getElementById("modalInput");
function openModal() { modalBackdrop.classList.add("open"); modalBackdrop.setAttribute("aria-hidden", "false"); setTimeout(() => modalInput.focus(), 20); }
function closeModal() { modalBackdrop.classList.remove("open"); modalBackdrop.setAttribute("aria-hidden", "true"); }
document.getElementById("quickAdd")?.addEventListener("click", openModal);
document.getElementById("closeModal")?.addEventListener("click", closeModal);
modalBackdrop?.addEventListener("click", (event) => { if (event.target === modalBackdrop) closeModal(); });
document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeModal(); });
document.getElementById("saveCapture")?.addEventListener("click", () => {
  const value = modalInput.value.trim();
  if (!value) { modalInput.focus(); return; }
  const record = createTextRecord(value, "note");
  saveRecords([...loadRecords(), record]);
  addAuditEvent("created", record);
  closeModal(); modalInput.value = ""; showView("inbox"); refreshDynamicSurfaces(); void syncRecordToCloud(record); showToast(ui("Saved to AI Inbox for confirmation.", "Сохранено в AI Inbox для подтверждения."));
});

document.getElementById("inboxCapture")?.addEventListener("click", () => { showView("inbox"); document.getElementById("captureText")?.focus(); });
document.getElementById("parseCapture")?.addEventListener("click", () => {
  const input = document.getElementById("captureText");
  if (!input.value.trim()) { input.focus(); return; }
  const record = createTextRecord(input.value.trim(), "note");
  saveRecords([...loadRecords(), record]);
  addAuditEvent("created", record);
  input.value = ""; refreshDynamicSurfaces(); void syncRecordToCloud(record); showToast(ui("Proposal created. Review it before confirming.", "Предложение создано. Проверьте его перед подтверждением."));
});
document.querySelectorAll(".proposal-buttons .confirm").forEach((button) => button.addEventListener("click", () => { button.textContent = ui("Confirmed", "Подтверждено"); button.disabled = true; button.parentElement.nextElementSibling?.remove(); showToast(ui("Proposal confirmed and added to your workspace.", "Предложение подтверждено и добавлено в рабочее пространство.")); }));
document.querySelectorAll(".proposal-buttons .ghost").forEach((button) => button.addEventListener("click", () => showToast(ui("Capture a corrected version below.", "Добавьте исправленную версию ниже."))));
document.getElementById("notificationButton")?.addEventListener("click", () => { const count = document.querySelector(".attention-count")?.textContent || "0"; showToast(ui(`${Number(count)} attention items are waiting.`, `Пунктов внимания: ${Number(count)}.`)); });

const activeFilters = {};
const taskPlannerState = { layout: "list", period: "all", priority: "all", type: "all", calendarOffset: 0 };
const plannerTaskChecks = document.querySelectorAll("[data-planner-task]");
try {
  const savedPlannerChecks = JSON.parse(localStorage.getItem("nikos-planner-checks") || "{}");
  plannerTaskChecks.forEach((checkbox) => { checkbox.checked = savedPlannerChecks[checkbox.dataset.plannerTask] === true; checkbox.closest(".table-row")?.classList.toggle("completed", checkbox.checked); });
} catch { /* Planner check state is optional. */ }
plannerTaskChecks.forEach((checkbox) => checkbox.addEventListener("change", () => {
  const savedPlannerChecks = {};
  plannerTaskChecks.forEach((item) => { savedPlannerChecks[item.dataset.plannerTask] = item.checked; item.closest(".table-row")?.classList.toggle("completed", item.checked); });
  try { localStorage.setItem("nikos-planner-checks", JSON.stringify(savedPlannerChecks)); } catch { /* Planner check state is optional. */ }
}));
function dateOnly(value) {
  const date = value ? new Date(`${value}T12:00:00`) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}
function taskDateFromRow(row) {
  const text = row.textContent.toLowerCase();
  if (text.includes("today") || text.includes("сегодня")) return new Date();
  if (text.includes("fri") || text.includes("пт") || text.includes("пятниц")) {
    const date = new Date();
    const daysUntilFriday = (5 - (date.getDay() || 7) + 7) % 7;
    date.setDate(date.getDate() + daysUntilFriday);
    return date;
  }
  return null;
}
function taskDueDateFromRow(row) {
  const date = dateOnly(row.dataset.recordDate) || taskDateFromRow(row);
  if (!date) return null;
  const time = row.textContent.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (time) date.setHours(Number(time[1]), Number(time[2]), 0, 0);
  else date.setHours(23, 59, 59, 999);
  return date;
}
function taskRowMatches(row, options = {}) {
  const includePeriod = options.includePeriod !== false;
  const text = row.textContent.toLowerCase();
  const status = row.dataset.recordStatus || "";
  const category = row.dataset.recordCategory || "";
  const priority = row.dataset.recordPriority || (row.classList?.contains("priority-high") ? "high" : text.includes("priority") || text.includes("приоритет") ? "high" : text.includes("waiting") || text.includes("ожида") ? "medium" : "low");
  const date = dateOnly(row.dataset.recordDate) || taskDateFromRow(row);
  const now = new Date();
  const periodEnd = new Date(now);
  if (includePeriod && taskPlannerState.period === "today") { if (!date || date.toDateString() !== now.toDateString()) return false; }
  if (includePeriod && taskPlannerState.period === "week") { periodEnd.setDate(now.getDate() + 7); if (!date || date < new Date(now.getFullYear(), now.getMonth(), now.getDate()) || date > periodEnd) return false; }
  if (includePeriod && taskPlannerState.period === "month") { if (!date || date.getMonth() !== now.getMonth() || date.getFullYear() !== now.getFullYear()) return false; }
  if (taskPlannerState.priority !== "all" && priority !== taskPlannerState.priority) return false;
  if (taskPlannerState.type !== "all") {
    const typeWords = { personal: ["personal", "личн"], finance: ["finance", "финанс"], property: ["property", "недвиж", "земел"], health: ["health", "здоров"], business: ["business", "бизнес"] }[taskPlannerState.type] || [];
    if (!typeWords.some((word) => `${text} ${category}`.includes(word))) return false;
  }
  return true;
}
function updateTaskFilterCounts() {
  const rows = [...document.querySelectorAll('[data-page="tasks"] .table-row, [data-page="tasks"] .record-row')];
  const counts = [rows.length, rows.filter((row) => { const date = taskDueDateFromRow(row); return date && date.toDateString() === new Date().toDateString(); }).length, rows.filter((row) => { const text = row.textContent.toLowerCase(); return text.includes("waiting") || text.includes("ожида") || row.dataset.recordStatus === "waiting"; }).length, rows.filter((row) => { const date = taskDueDateFromRow(row); return row.dataset.recordStatus === "overdue" || (date && date < new Date()); }).length];
  document.querySelectorAll('[data-page="tasks"] .filter-row .filter-chip b').forEach((node, index) => { node.textContent = counts[index] ?? 0; });
}
document.querySelectorAll(".filter-chip").forEach((chip) => chip.addEventListener("click", () => {
  const page = chip.closest(".page-view")?.dataset.page || "global";
  chip.parentElement.querySelectorAll(".filter-chip").forEach((item) => item.classList.remove("selected"));
  chip.classList.add("selected");
  const label = chip.textContent.replace(/\s+/g, " ").trim();
  activeFilters[page] = label;
  applyPageFilter(page, label);
  if (page === "tasks" && taskPlannerState.layout === "calendar") renderTaskCalendar();
  if (page === "cashflow") { renderCashflowEntries(); renderCashflowMetrics(); }
  showToast(ui(`${label} view selected.`, `Фильтр «${label}» применён.`));
}));

/* V0.2: local-first actions, global search, and structured capture forms. */
const ui = (en, ruText) => locale === "ru" ? ruText : en;
const dataModalBackdrop = document.getElementById("dataModalBackdrop");
const dataModalTitle = document.getElementById("dataModalTitle");
const dataModalCopy = document.getElementById("dataModalCopy");
const dataForm = document.getElementById("dataForm");
const dataName = document.getElementById("dataName");
const dataCounterparty = document.getElementById("dataCounterparty");
const dataAmount = document.getElementById("dataAmount");
const dataCurrency = document.getElementById("dataCurrency");
const dataDate = document.getElementById("dataDate");
const dataStatus = document.getElementById("dataStatus");
const dataPriority = document.getElementById("dataPriority");
const dataTerms = document.getElementById("dataTerms");
const dataOwner = document.getElementById("dataOwner");
const dataDetails = document.getElementById("dataDetails");
const dataCategory = document.getElementById("dataCategory");
const dataSource = document.getElementById("dataSource");
const dataConfidence = document.getElementById("dataConfidence");
const dataReminder = document.getElementById("dataReminder");
const dataLinkedRecord = document.getElementById("dataLinkedRecord");
let activeFormType = "record";
let editingRecordId = null;
const categoryOptions = {
  task: [["personal", "Personal", "Личное"], ["finance", "Finance", "Финансы"], ["property", "Property", "Недвижимость"], ["health", "Health", "Здоровье"], ["other", "Other", "Другое"]],
  project: [["personal", "Personal", "Личное"], ["finance", "Finance", "Финансы"], ["property", "Property", "Недвижимость"], ["business", "Business", "Бизнес"], ["other", "Other", "Другое"]],
  note: [["other", "Note", "Заметка"]],
  health: [["checkup", "Check-up", "Осмотр"], ["condition", "Condition / diagnosis", "Состояние / диагноз"], ["routine", "Routine", "Режим / привычка"], ["medication", "Medication", "Лекарство"], ["fitness", "Fitness", "Физическая активность"], ["training", "Training session", "Тренировка"], ["other", "Other", "Другое"]],
  account: [["bank", "Bank account", "Банковский счёт"], ["brokerage", "Brokerage", "Брокерский счёт"], ["cash", "Cash", "Наличные"], ["business_account", "Business account", "Счёт бизнеса"]],
  receivable: [["friend", "Friend / person", "Друг / человек"], ["car_reseller", "Car reseller", "Перекупщик авто"], ["business", "Business", "Бизнес"], ["other", "Other", "Другое"]],
  payable: [["mortgage", "Mortgage", "Ипотека"], ["person", "Person", "Человек"], ["business", "Business", "Бизнес"], ["other", "Other", "Другое"]],
  debt: [["receivable", "Money owed to me", "Мне должны"], ["payable", "I owe", "Я должен"], ["mortgage", "Mortgage", "Ипотека"], ["other", "Other", "Другое"]],
  income: [["business", "Business", "Бизнес"], ["salary", "Salary", "Зарплата"], ["interest", "Interest", "Проценты"], ["rent", "Rent", "Аренда"], ["other", "Other", "Другое"]],
  expense: [["mortgage", "Mortgage", "Ипотека"], ["living", "Living", "Жизнь"], ["business", "Business", "Бизнес"], ["tax", "Tax", "Налог"], ["interest", "Interest", "Проценты"], ["other", "Other", "Другое"]],
  investment: [["construction_project", "Construction project", "Строительный проект"], ["jetlend", "Jetlend", "Jetlend"], ["car_resale_deal", "Car-reseller deal", "Сделка с перекупщиком авто"], ["brokerage", "Brokerage position", "Брокерская позиция"], ["business_investment", "Business investment", "Инвестиция в бизнес"], ["other", "Other", "Другое"]],
  asset: [["car", "Car", "Автомобиль"], ["land", "Land", "Земля"], ["house", "House", "Дом"], ["apartment", "Apartment", "Квартира"], ["business", "Business interest", "Доля / интерес в бизнесе"], ["other", "Other", "Другое"]],
  property: [["land", "Land", "Земля"], ["house", "House", "Дом"], ["apartment", "Apartment", "Квартира"], ["other", "Other", "Другое"]],
  business: [["construction_project", "Construction project", "Строительный проект"], ["car_resale_deal", "Car-reseller deal", "Сделка с перекупщиком авто"], ["other", "Other", "Другое"]],
  document: [["property", "Property", "Недвижимость"], ["finance", "Finance", "Финансы"], ["contract", "Contract", "Договор"], ["other", "Other", "Другое"]],
  person: [["family", "Family", "Семья"], ["business", "Business", "Бизнес"], ["other", "Other", "Другое"]],
  decision: [["finance", "Finance", "Финансы"], ["property", "Property", "Недвижимость"], ["life", "Life", "Жизнь"], ["other", "Other", "Другое"]],
  event: [["life", "Life", "Жизнь"], ["finance", "Finance", "Финансы"], ["other", "Other", "Другое"]],
  crypto: [["wallet", "Public wallet", "Публичный кошелёк"], ["exchange", "Exchange read-only", "Биржа только чтение"], ["other", "Other", "Другое"]],
  privacy: [["private", "Private", "Приватный"]],
  integration: [["read_only", "Read-only source", "Источник только чтение"], ["calendar", "Calendar", "Календарь"], ["other", "Other", "Другое"]]
};
const formCopy = {
  task: { title: ["Add task", "Добавить задачу"], copy: ["Capture the next action with an optional due date and context.", "Зафиксируйте следующее действие, срок и контекст."], name: ["e.g. Call the contractor", "Например: позвонить подрядчику"] },
  project: { title: ["Add project", "Добавить проект"], copy: ["Keep an outcome, owner, and next action in one place.", "Храните результат, владельца и следующий шаг в одном месте."], name: ["e.g. Renovation project", "Например: проект ремонта"] },
  note: { title: ["Add note", "Добавить заметку"], copy: ["Keep the thought private until you confirm what it means.", "Сохраните мысль приватно, пока не подтвердите её смысл."], name: ["e.g. Follow-up note", "Например: заметка для продолжения"] },
  health: { title: ["Add health record", "Добавить запись о здоровье"], copy: ["Keep a private routine or health context. Nik'Os does not diagnose or replace medical care.", "Сохраните личную привычку или контекст здоровья. Nik'Os не ставит диагнозов и не заменяет медицинскую помощь."], name: ["e.g. Annual check-up", "Например: ежегодный осмотр"] },
  account: { title: ["Add account", "Добавить счёт"], copy: ["Start a verified capital record. Nothing is connected automatically.", "Начните подтверждённую запись капитала. Ничего не подключается автоматически."], name: ["e.g. Personal checking", "Например: личный расчётный счёт"] },
  debt: { title: ["Add debt", "Добавить долг"], copy: ["Record who owes whom, the principal, due date, and evidence. It will stay needs confirmation until you verify it.", "Зафиксируйте, кто кому должен, сумму, срок и подтверждение. Запись останется требующей подтверждения до вашей проверки."], name: ["e.g. Loan to a car reseller", "Например: займ перекупщику"] },
  receivable: { title: ["Add receivable", "Добавить дебиторку"], copy: ["Record a person, partner, or business that owes you money.", "Зафиксируйте человека, партнёра или компанию, которые должны вам деньги."], name: ["e.g. Partner loan", "Например: займ партнёру"] },
  payable: { title: ["Add payable", "Добавить кредиторку"], copy: ["Record money you owe to a person, business, or institution.", "Зафиксируйте деньги, которые вы должны человеку, бизнесу или организации."], name: ["e.g. Business loan", "Например: долг бизнесу"] },
  income: { title: ["Add income", "Добавить доход"], copy: ["Record income with its source and date. It stays local until the backend is connected.", "Зафиксируйте доход с источником и датой. Он останется локальным до подключения серверной части."], name: ["e.g. Business income", "Например: доход от бизнеса"] },
  expense: { title: ["Add expense", "Добавить расход"], copy: ["Record an expense with its category and date.", "Зафиксируйте расход с категорией и датой."], name: ["e.g. Mortgage payment", "Например: платёж по ипотеке"] },
  investment: { title: ["Add investment", "Добавить инвестицию"], copy: ["Choose a status explicitly. Discussed opportunities remain unowned until you confirm them.", "Явно выберите статус. Обсуждаемые возможности не считаются владением без подтверждения."], name: ["e.g. Brokerage position", "Например: позиция у брокера"] },
  asset: { title: ["Add asset", "Добавить актив"], copy: ["Create a private record marked needs confirmation until ownership is verified.", "Создайте приватную запись, отмеченную как требующая подтверждения до проверки владения."], name: ["e.g. Vehicle or valuable", "Например: автомобиль или ценность"] },
  property: { title: ["Add property", "Добавить недвижимость"], copy: ["Add the property context first; valuation and ownership can be verified later.", "Сначала добавьте контекст недвижимости; стоимость и владение можно подтвердить позже."], name: ["e.g. Apartment or land", "Например: квартира или участок"] },
  business: { title: ["Add business", "Добавить бизнес"], copy: ["Record the relationship without assuming ownership.", "Зафиксируйте связь с бизнесом, не предполагая владение."], name: ["e.g. Company or project", "Например: компания или проект"] },
  document: { title: ["Add document", "Добавить документ"], copy: ["Save a private document reference and link it later to an asset, person, or project.", "Сохраните приватную ссылку на документ и позже свяжите её с активом, человеком или проектом."], name: ["e.g. Property statement.pdf", "Например: выписка по недвижимости.pdf"] },
  person: { title: ["Add person", "Добавить человека"], copy: ["Keep only the relationship context that helps work move.", "Храните только контекст отношений, который помогает делу двигаться."], name: ["e.g. Contractor", "Например: подрядчик"] },
  decision: { title: ["Log decision", "Записать решение"], copy: ["Capture the reasoning now so future you can review it with evidence.", "Зафиксируйте ход мысли сейчас, чтобы позже пересмотреть решение с опорой на факты."], name: ["e.g. Keep or sell the asset", "Например: оставить или продать актив"] },
  event: { title: ["Add timeline event", "Добавить событие таймлайна"], copy: ["Record a meaningful change in the long view of your life.", "Зафиксируйте значимое изменение в долгой истории вашей жизни."], name: ["e.g. Signed a new agreement", "Например: подписан новый договор"] },
  privacy: { title: ["Privacy preference", "Настройка приватности"], copy: ["Nik'Os is private by default. This control will become granular when authentication is connected.", "Nik'Os приватен по умолчанию. Детальные уровни появятся после подключения авторизации."], name: ["Private by default", "Приватность по умолчанию"] },
  integration: { title: ["Connect an integration", "Подключить интеграцию"], copy: ["Choose a source later. Financial and crypto connections will be read-only by design.", "Источник можно выбрать позже. Финансовые и криптоподключения будут только для чтения."], name: ["e.g. Calendar or read-only account", "Например: календарь или счёт только для чтения"] }
};

function createTextRecord(text, type = "note") {
  const cleanText = String(text).trim();
  const lower = cleanText.toLowerCase();
  const suggestedType = /whoop|сон|вес|трен|здоров|самочувств/.test(lower) ? "health" : /долж|долг|займ|ипотек/.test(lower) ? "debt" : /инвест|jetlend|строй|перекуп/.test(lower) ? "investment" : /решить|решение|выбрать/.test(lower) ? "decision" : /сделать|проверить|позвон|уточнить|нужно/.test(lower) ? "task" : "note";
  return { id: (globalThis.crypto?.randomUUID?.() || `nikos-${Date.now()}-${Math.random().toString(36).slice(2)}`), type, suggestedType, category: "other", name: cleanText.slice(0, 90), counterparty: "", amount: null, currency: "RUB", date: null, terms: "", owner: "Me", source: "AI Inbox", confidence: "low", reminderDate: null, linkedRecordId: null, details: cleanText, status: "needs confirmation", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
}
const auditStorageKey = "nikos-audit";
function loadAudit() {
  try { const events = JSON.parse(localStorage.getItem(auditStorageKey) || "[]"); return Array.isArray(events) ? events : []; } catch { return []; }
}
function saveAudit(events) { try { localStorage.setItem(auditStorageKey, JSON.stringify(events.slice(-100))); } catch { /* Audit is best-effort when storage is unavailable. */ } }
function addAuditEvent(action, record) {
  if (!record) return;
  const event = { id: globalThis.crypto?.randomUUID?.() || `audit-${Date.now()}`, action, type: record.type || "record", recordId: record.id || null, name: String(record.name || "").slice(0, 120), at: new Date().toISOString() };
  saveAudit([...loadAudit(), event]);
  renderAuditTrail();
}
function auditActionLabel(action) {
  return ({ created: ui("Created", "Создано"), updated: ui("Updated", "Изменено"), archived: ui("Archived", "Архивировано"), deleted: ui("Deleted", "Удалено"), imported: ui("Imported", "Импортировано") })[action] || action;
}
function renderAuditTrail() {
  const host = document.getElementById("auditRecords");
  if (!host) return;
  const events = loadAudit().slice(-10).reverse();
  host.innerHTML = events.length ? events.map((event) => `<div class="audit-event"><span class="audit-dot"></span><span><strong>${escapeHtml(auditActionLabel(event.action))}: ${escapeHtml(event.name || ui("record", "запись"))}</strong><small>${escapeHtml(new Date(event.at).toLocaleString(locale === "ru" ? "ru-RU" : "en-US"))}</small></span></div>`).join("") : `<div class="ledger-empty">${ui("Changes will appear here.", "Здесь появятся изменения.")}</div>`;
}
function ensureDocumentPicker() {
  if (document.getElementById("dataFileField") || !dataForm) return;
  const label = document.createElement("label");
  label.id = "dataFileField";
  label.dataset.formField = "file";
  label.hidden = true;
  const caption = document.createElement("span");
  caption.textContent = ui("Attach file (metadata only)", "Прикрепить файл (только сведения о файле)");
  const input = document.createElement("input");
  input.id = "dataFile";
  input.type = "file";
  input.accept = ".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.csv";
  label.append(caption, input);
  dataForm.insertBefore(label, dataForm.querySelector(".modal-footer"));
}

const formFieldVisibility = {
  task: ["name", "category", "date", "status", "priority", "owner", "source", "confidence", "reminder", "linked", "details"],
  project: ["name", "category", "date", "status", "priority", "owner", "source", "confidence", "reminder", "linked", "details"],
  note: ["name", "category", "date", "owner", "source", "confidence", "reminder", "linked", "details"],
  health: ["name", "category", "date", "status", "priority", "owner", "source", "confidence", "reminder", "linked", "details"],
  account: ["name", "category", "counterparty", "amount", "currency", "date", "status", "owner", "source", "confidence", "reminder", "linked", "details"],
  debt: ["name", "category", "counterparty", "amount", "currency", "date", "status", "priority", "terms", "owner", "source", "confidence", "reminder", "linked", "details"],
  receivable: ["name", "category", "counterparty", "amount", "currency", "date", "status", "priority", "terms", "owner", "source", "confidence", "reminder", "linked", "details"],
  payable: ["name", "category", "counterparty", "amount", "currency", "date", "status", "priority", "terms", "owner", "source", "confidence", "reminder", "linked", "details"],
  income: ["name", "category", "amount", "currency", "date", "status", "owner", "source", "confidence", "reminder", "linked", "details"],
  expense: ["name", "category", "amount", "currency", "date", "status", "owner", "source", "confidence", "reminder", "linked", "details"],
  investment: ["name", "category", "counterparty", "amount", "currency", "date", "status", "priority", "terms", "owner", "source", "confidence", "reminder", "linked", "details"],
  asset: ["name", "category", "counterparty", "amount", "currency", "date", "status", "owner", "source", "confidence", "reminder", "linked", "details"],
  property: ["name", "category", "counterparty", "amount", "currency", "date", "status", "owner", "source", "confidence", "reminder", "linked", "details"],
  business: ["name", "category", "counterparty", "amount", "currency", "date", "status", "owner", "source", "confidence", "reminder", "linked", "details"],
  document: ["name", "category", "date", "status", "owner", "source", "confidence", "reminder", "linked", "file", "details"],
  person: ["name", "category", "counterparty", "owner", "source", "confidence", "reminder", "linked", "details"],
  decision: ["name", "category", "date", "status", "priority", "owner", "source", "confidence", "reminder", "linked", "details"],
  event: ["name", "category", "date", "owner", "source", "confidence", "reminder", "linked", "details"],
  crypto: ["name", "category", "counterparty", "amount", "currency", "date", "status", "owner", "source", "confidence", "reminder", "linked", "details"],
  privacy: ["name", "category", "details"],
  integration: ["name", "category", "details"]
};

function updateDataFormFields(type) {
  const visible = new Set(formFieldVisibility[type] || formFieldVisibility.asset);
  dataForm?.querySelectorAll("[data-form-field]").forEach((field) => {
    const isVisible = visible.has(field.dataset.formField);
    field.hidden = !isVisible;
    field.setAttribute("aria-hidden", String(!isVisible));
  });
  const categoryLabel = dataForm?.querySelector('[data-form-field="category"] span');
  if (categoryLabel) categoryLabel.textContent = type === "privacy" ? ui("Privacy level", "Уровень приватности") : type === "integration" ? ui("Integration type", "Тип интеграции") : ui("Category / type", "Категория / тип");
}

function populateLinkedRecordOptions(existing = null) {
  if (!dataLinkedRecord) return;
  const records = loadRecords().filter((record) => record.id !== existing?.id && record.status !== "archived").slice(-80).reverse();
  dataLinkedRecord.innerHTML = `<option value="">${ui("No link", "Без связи")}</option>${records.map((record) => `<option value="${escapeHtml(record.id)}">${escapeHtml(record.name)} · ${escapeHtml(categoryLabel(record))}</option>`).join("")}`;
  dataLinkedRecord.value = existing?.linkedRecordId || "";
}

function openDataForm(type = "record", existing = null) {
  activeFormType = type;
  editingRecordId = existing?.id || null;
  ensureDocumentPicker();
  const copy = formCopy[type] || formCopy.asset;
  dataModalTitle.textContent = ui(copy.title[0], copy.title[1]);
  dataModalCopy.textContent = ui(copy.copy[0], copy.copy[1]);
  dataName.placeholder = ui(copy.name[0], copy.name[1]);
  dataName.value = existing?.name || (type === "privacy" ? ui(copy.name[0], copy.name[1]) : "");
  dataCounterparty.value = existing?.counterparty || "";
  dataAmount.value = existing?.amount ?? "";
  dataCurrency.value = existing?.currency || "RUB";
  dataDate.value = existing?.date || "";
  dataStatus.value = existing?.status || (type === "privacy" ? "confirmed" : "needs confirmation");
  if (dataPriority) dataPriority.value = existing?.priority || "medium";
  dataTerms.value = existing?.terms || "";
  dataOwner.value = existing?.owner || "Me";
  dataDetails.value = existing?.details || "";
  if (dataSource) dataSource.value = existing?.source || "";
  if (dataConfidence) dataConfidence.value = existing?.confidence || "medium";
  if (dataReminder) dataReminder.value = existing?.reminderDate || "";
  const fileField = document.getElementById("dataFileField");
  const fileInput = document.getElementById("dataFile");
  if (fileField) fileField.hidden = type !== "document";
  if (fileInput) fileInput.value = "";
  const options = categoryOptions[type] || categoryOptions.asset;
  dataCategory.innerHTML = options.map(([value, en, ruText]) => `<option value="${value}">${ui(en, ruText)}</option>`).join("");
  dataCategory.value = options[0]?.[0] || "other";
  populateLinkedRecordOptions(existing);
  updateDataFormFields(type);
  dataModalTitle.textContent = existing ? ui("Edit record", "Изменить запись") : ui(copy.title[0], copy.title[1]);
  dataModalBackdrop.classList.add("open");
  dataModalBackdrop.setAttribute("aria-hidden", "false");
  setTimeout(() => dataName.focus(), 20);
}
function closeDataForm() { dataModalBackdrop.classList.remove("open"); dataModalBackdrop.setAttribute("aria-hidden", "true"); }
document.querySelectorAll("[data-open-form]").forEach((button) => button.addEventListener("click", () => openDataForm(button.dataset.openForm)));
document.getElementById("taskAdd")?.addEventListener("click", () => openDataForm("task"));
document.getElementById("projectAdd")?.addEventListener("click", () => openDataForm("project"));
document.getElementById("closeDataModal")?.addEventListener("click", closeDataForm);
dataModalBackdrop?.addEventListener("click", (event) => { if (event.target === dataModalBackdrop) closeDataForm(); });
dataForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  if (["debt", "receivable", "payable"].includes(activeFormType) && !dataCounterparty.value.trim()) { dataCounterparty.focus(); showToast(ui("Add the counterparty so the debt has context.", "Укажите контрагента, чтобы у долга был контекст.")); return; }
  const previous = editingRecordId ? loadRecords().find((item) => item.id === editingRecordId) : null;
  const selectedFile = document.getElementById("dataFile")?.files?.[0];
  const attachment = selectedFile ? { name: selectedFile.name, size: selectedFile.size, type: selectedFile.type } : previous?.attachment || null;
  const record = { id: editingRecordId || (globalThis.crypto?.randomUUID?.() || `nikos-${Date.now()}-${Math.random().toString(36).slice(2)}`), type: activeFormType, category: dataCategory.value, name: dataName.value.trim(), counterparty: dataCounterparty.value.trim(), amount: dataAmount.value ? Number(dataAmount.value) : null, currency: dataCurrency.value, date: dataDate.value || null, terms: dataTerms.value.trim(), owner: dataOwner.value, details: dataDetails.value.trim(), status: dataStatus.value, priority: dataPriority?.value || "medium", source: dataSource?.value.trim() || "", confidence: dataConfidence?.value || "medium", reminderDate: dataReminder?.value || null, linkedRecordId: dataLinkedRecord?.value || null, attachment, createdAt: editingRecordId ? (previous?.createdAt || new Date().toISOString()) : new Date().toISOString(), updatedAt: new Date().toISOString() };
  if (!record.name) return;
  let records = [];
  try { records = JSON.parse(localStorage.getItem("nikos-records") || "[]"); } catch { records = []; }
  const existingIndex = records.findIndex((item) => item.id === record.id);
  if (existingIndex >= 0) records[existingIndex] = record; else records.push(record);
  saveRecords(records);
  addAuditEvent(existingIndex >= 0 ? "updated" : "created", record);
  editingRecordId = null;
  closeDataForm();
  showToast(ui(existingIndex >= 0 ? "Record updated." : "Record saved locally for confirmation.", existingIndex >= 0 ? "Запись обновлена." : "Запись сохранена локально для подтверждения."));
  refreshDynamicSurfaces();
  void syncRecordToCloud(record);
});

function loadRecords() {
  try {
    const records = JSON.parse(localStorage.getItem("nikos-records") || "[]");
    return Array.isArray(records) ? records : [];
  } catch { return []; }
}
function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
}
function formatRecordAmount(record) {
  if (record.type === "health") return "—";
  return record.amount === null || record.amount === undefined || Number.isNaN(Number(record.amount)) ? "—" : `${Number(record.amount).toLocaleString(locale === "ru" ? "ru-RU" : "en-US")} ${escapeHtml(record.currency || "RUB")}`;
}
function confidenceLabel(value) {
  return ({ low: ui("Low", "Низкая"), medium: ui("Medium", "Средняя"), high: ui("High", "Высокая") })[value] || value || ui("Unknown", "Неизвестно");
}
function formatRecordMeta(record) {
  const linked = record.linkedRecordId ? loadRecords().find((item) => item.id === record.linkedRecordId) : null;
  const bits = [record.counterparty, record.date, record.terms, record.owner && record.owner !== "Me" ? record.owner : "", record.source ? `${ui("Source", "Источник")}: ${record.source}` : "", record.confidence ? `${ui("Confidence", "Уверенность")}: ${confidenceLabel(record.confidence)}` : "", record.reminderDate ? `${ui("Reminder", "Напоминание")}: ${record.reminderDate}` : "", linked ? `${ui("Link", "Связь")}: ${linked.name}` : "", record.details].filter(Boolean).map(escapeHtml);
  return `${escapeHtml(statusLabel(record.status))}${bits.length ? ` · ${bits.join(" · ")}` : ""}`;
}
function statusLabel(status) {
  const labels = { "needs confirmation": ["Needs confirmation", "Нужно подтверждение"], confirmed: ["Confirmed", "Подтверждено"], active: ["Active", "Активно"], waiting: ["Waiting", "Ожидает"], paid: ["Paid", "Оплачено"], overdue: ["Overdue", "Просрочено"], archived: ["Archived", "В архиве"] };
  const label = labels[status] || [status || "—", status || "—"];
  return ui(label[0], label[1]);
}
function categoryLabel(record) {
  const options = categoryOptions[record.type] || [];
  const match = options.find(([value]) => value === record.category);
  return match ? ui(match[1], match[2]) : (record.category || ui("Record", "Запись"));
}
function suggestionLabel(type) {
  return ({ health: ui("Health suggestion", "Предложение: здоровье"), debt: ui("Debt suggestion", "Предложение: долг"), investment: ui("Investment suggestion", "Предложение: инвестиция"), decision: ui("Decision suggestion", "Предложение: решение"), task: ui("Task suggestion", "Предложение: задача") })[type] || "";
}
function recordMarkup(record, className = "") {
  const icon = record.type === "investment" ? "◇" : record.type === "asset" || record.type === "property" ? "⌂" : record.type === "task" ? "✓" : record.type === "project" ? "↗" : record.type === "note" ? "✦" : "◈";
  return `<div class="record-row ${className}" data-record-type="${escapeHtml(record.type)}" data-record-category="${escapeHtml(record.category || "")}" data-record-status="${escapeHtml(record.status || "")}" data-record-priority="${escapeHtml(record.priority || "medium")}" data-record-date="${escapeHtml(record.date || "")}"><span class="record-icon">${icon}</span><span class="record-main"><strong>${escapeHtml(record.name)}</strong><small>${escapeHtml(categoryLabel(record))}${record.counterparty ? ` · ${escapeHtml(record.counterparty)}` : ""}${record.suggestedType && record.type === "note" ? ` · ${escapeHtml(suggestionLabel(record.suggestedType))}` : ""}</small><small>${formatRecordMeta(record)}</small></span><span class="record-amount">${formatRecordAmount(record)}</span><span class="record-actions"><button class="small-button record-action" data-record-action="edit" data-record-id="${escapeHtml(record.id)}" aria-label="${ui("Edit", "Изменить")}">✎</button><button class="small-button record-action" data-record-action="archive" data-record-id="${escapeHtml(record.id)}" aria-label="${ui("Archive", "Архивировать")}">⌁</button><button class="small-button record-action danger" data-record-action="delete" data-record-id="${escapeHtml(record.id)}" aria-label="${ui("Delete", "Удалить")}">×</button></span></div>`;
}
function renderUploadedFiles(records = loadRecords()) {
  const host = document.getElementById("uploadedFiles");
  if (!host) return;
  const docs = records.filter((record) => record.type === "document").slice(-4).reverse();
  host.innerHTML = docs.length ? docs.map((doc) => recordMarkup(doc, "uploaded-record")).join("") : "";
}
function cashflowRecordsForPeriod(records = loadRecords()) {
  const normalized = (activeFilters.cashflow || ui("This month", "Этот месяц")).toLowerCase();
  if (!(normalized.includes("this month") || normalized.includes("этот месяц"))) return records;
  const now = new Date();
  return records.filter((record) => {
    if (!record.date) return false;
    const date = new Date(`${record.date}T00:00:00`);
    return !Number.isNaN(date.getTime()) && date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  });
}
function renderCashflowEntries(records = loadRecords()) {
  const host = document.getElementById("cashflowEntries");
  if (!host) return;
  const entries = cashflowRecordsForPeriod(records).filter((record) => record.type === "income" || record.type === "expense").slice(-6).reverse();
  host.innerHTML = entries.length ? entries.map((entry) => `<div class="cashflow-entry ${entry.type}"><span><strong>${escapeHtml(entry.name)}</strong><small>${formatRecordMeta(entry)}</small></span><span class="entry-amount">${entry.type === "income" ? "+" : "−"} ${formatRecordAmount(entry)}</span></div>`).join("") : `<div class="ledger-empty">${ui("Add your first income or expense. Transfers between your own accounts stay separate.", "Добавьте первый доход или расход. Переводы между своими счетами останутся отдельно.")}</div>`;
}
function renderRecordList(hostId, records, emptyText) {
  const host = document.getElementById(hostId);
  if (!host) return;
  host.innerHTML = records.length ? records.slice(-8).reverse().map((record) => recordMarkup(record)).join("") : `<div class="ledger-empty">${emptyText}</div>`;
}
function renderDebtRecords(records) {
  const receivables = records.filter((record) => record.type === "receivable" || (record.type === "debt" && record.category === "receivable"));
  const payables = records.filter((record) => record.type === "payable" || (record.type === "debt" && ["payable", "mortgage"].includes(record.category)));
  renderRecordList("receivableRecords", receivables, ui("No receivables added yet.", "Дебиторка пока не добавлена."));
  renderRecordList("payableRecords", payables, ui("No payables added yet.", "Кредиторка пока не добавлена."));
  document.querySelectorAll(".debt-card").forEach((card) => {
    const isPayable = card.classList.contains("payable");
    const total = formatTotals(isPayable ? payables : receivables);
    const totalNode = card.querySelector(".debt-total");
    if (totalNode) totalNode.textContent = total === "—" ? "$—" : total;
    const note = card.querySelector("p");
    if (note) note.textContent = (isPayable ? payables : receivables).length ? ui("Saved locally; verify each balance.", "Сохранено локально; проверьте каждый баланс.") : (isPayable ? ui("No confirmed liabilities yet.", "Подтверждённых обязательств пока нет.") : ui("No confirmed receivables yet.", "Подтверждённой дебиторки пока нет."));
  });
}
function renderDynamicRecords(records = loadRecords()) {
  ensureDynamicHost("peopleRecords", '[data-page="people"] .relationship-panel');
  ensureDynamicHost("decisionRecords", '[data-page="decisions"] .decision-template');
  ensureDynamicHost("timelineRecords", '[data-page="timeline"] .history-panel');
  ensureDynamicHost("auditRecords", '[data-page="timeline"] .history-panel');
  ensureDynamicHost("healthRecords", '[data-page="health"] .records-panel');
  renderRecordList("taskRecords", records.filter((record) => record.type === "task"), ui("No personal tasks added yet.", "Личных задач пока нет."));
  renderRecordList("projectRecords", records.filter((record) => record.type === "project"), ui("No projects added yet.", "Проектов пока нет."));
  renderInboxRecords(records);
  renderRecordList("accountRecords", records.filter((record) => record.type === "account"), ui("Add a bank, brokerage, cash, or business account.", "Добавьте банковский, брокерский, наличный или бизнес-счёт."));
  renderDebtRecords(records);
  renderRecordList("investmentRecords", records.filter((record) => record.type === "investment"), ui("Add construction, Jetlend, car-reseller, brokerage, or another position.", "Добавьте строительство, Jetlend, сделку с перекупщиком, брокерскую позицию или другую инвестицию."));
  updateInvestmentFilterCounts(records);
  renderInvestmentReviewCalendar(records);
  renderRecordList("cryptoRecords", records.filter((record) => record.type === "crypto"), ui("Add a public wallet address or a read-only exchange source.", "Добавьте публичный адрес кошелька или источник биржи только для чтения."));
  renderRecordList("assetRecords", records.filter((record) => record.type === "asset" || record.type === "property" || record.type === "business"), ui("Add a car, land, house, apartment, or business interest.", "Добавьте автомобиль, землю, дом, квартиру или интерес в бизнесе."));
  renderRecordList("peopleRecords", records.filter((record) => record.type === "person"), ui("No people added yet.", "Людей пока нет."));
  renderRecordList("decisionRecords", records.filter((record) => record.type === "decision"), ui("No decisions added yet.", "Решений пока нет."));
  renderRecordList("timelineRecords", records.filter((record) => record.type === "event"), ui("No timeline events added yet.", "Событий таймлайна пока нет."));
  renderRecordList("healthRecords", records.filter((record) => record.type === "health"), ui("No health records added yet.", "Записей о здоровье пока нет."));
  renderHealthSignals(records);
  renderReminders(records);
  renderAuditTrail();
}

function updateInvestmentFilterCounts(records = loadRecords()) {
  const investments = records.filter((record) => record.type === "investment" && record.status !== "archived");
  const counts = {
    owned: investments.filter((record) => ["confirmed", "active"].includes(record.status)).length,
    proposed: investments.filter((record) => record.status === "needs confirmation").length,
    watchlist: investments.filter((record) => record.status === "waiting").length
  };
  document.querySelectorAll('[data-page="investments"] [data-investment-mode]').forEach((chip) => {
    const count = chip.querySelector("b");
    if (count && counts[chip.dataset.investmentMode] !== undefined) count.textContent = counts[chip.dataset.investmentMode];
  });
}

function renderInvestmentReviewCalendar(records = loadRecords()) {
  const host = document.getElementById("investmentReviewRows");
  if (!host) return;
  const investments = records.filter((record) => record.type === "investment" && record.status !== "archived");
  const dated = investments.map((record) => ({ record, reviewDate: record.reminderDate || record.date || "" })).filter((item) => item.reviewDate).sort((a, b) => a.reviewDate.localeCompare(b.reviewDate));
  host.innerHTML = dated.length ? dated.map(({ record, reviewDate }) => `<div class="review-calendar-row"><span><strong>${escapeHtml(record.name)}</strong><small>${escapeHtml(categoryLabel(record))} · ${escapeHtml(statusLabel(record.status))}</small></span><time datetime="${escapeHtml(reviewDate)}">${escapeHtml(reviewDate)}</time></div>`).join("") : `<div class="ledger-empty">${ui("Add a review date to an investment to see it here.", "Добавьте дату пересмотра инвестиции, чтобы увидеть её здесь.")}</div>`;
}
function renderInboxRecords(records = loadRecords()) {
  document.querySelectorAll('[data-page="inbox"] .proposal-card').forEach((card) => card.remove());
  renderRecordList("inboxRecords", records.filter((record) => record.type === "note" && record.status !== "archived"), ui("No captured thoughts yet.", "Сохранённых мыслей пока нет."));
  const count = document.getElementById("proposalCount");
  if (count) {
    const total = records.filter((record) => record.type === "note" && record.status !== "archived").length;
    count.textContent = `${total} ${ui("proposals", "предложений")}`;
  }
}
function renderHealthSignals(records = loadRecords()) {
  const health = records.filter((record) => record.type === "health");
  const cards = [...document.querySelectorAll('[data-page="health"] .health-metric')];
  const groups = [[/sleep|сон/i, "SLEEP"], [/recover|восстанов|hrv/i, "RECOVERY"], [/weight|вес|мас[сс]/i, "WEIGHT TREND"], [/train|трен|fitness|нагруз/i, "TRAINING"]];
  cards.forEach((card, index) => {
    const matches = health.filter((record) => groups[index]?.[0].test(`${record.name} ${record.details || ""} ${record.category}`));
    const value = card.querySelector("strong");
    const note = card.querySelector("small");
    if (value) value.textContent = matches.length ? `${matches.length}` : "—";
    if (note) note.textContent = matches.length ? ui("unverified signals", "непроверенных сигналов") : ui("Add or import a signal", "Добавьте или импортируйте показатель");
  });
  const whoopCard = [...document.querySelectorAll('[data-page="health"] .health-source')].find((card) => card.textContent.toLowerCase().includes("whoop"));
  if (whoopCard && !whoopCard.querySelector("[data-health-csv]")) {
    const button = document.createElement("button");
    button.className = "text-button health-import-button";
    button.dataset.healthCsv = "true";
    button.textContent = ui("Import CSV", "Импорт CSV");
    button.addEventListener("click", () => ensureCsvPicker().click());
    whoopCard.appendChild(button);
  }
}

function renderReminders(records = loadRecords()) {
  const host = document.getElementById("attentionList");
  if (!host) return;
  host.querySelectorAll("[data-dynamic-attention]").forEach((item) => item.remove());
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcoming = records.filter((record) => record.reminderDate && record.status !== "archived").map((record) => ({ record, date: dateOnly(record.reminderDate) })).filter((item) => item.date).sort((a, b) => a.date - b.date).slice(0, 3);
  upcoming.forEach(({ record, date }) => {
    const button = document.createElement("button");
    button.className = `attention-row ${date < today ? "critical" : "info"}`;
    button.dataset.dynamicAttention = "true";
    button.innerHTML = `<span class="attention-marker">${date < today ? "!" : "↻"}</span><span><strong>${escapeHtml(date < today ? ui("Reminder overdue", "Напоминание просрочено") : ui("Reminder coming up", "Скоро напоминание"))}</strong><small>${escapeHtml(record.name)} · ${escapeHtml(record.reminderDate)}</small></span><span class="attention-arrow">↗</span>`;
    button.addEventListener("click", () => { showView(recordView(record.type)); showToast(ui("Related record opened.", "Открыта связанная запись.")); });
    host.appendChild(button);
  });
  const total = host.children.length;
  const count = document.querySelector(".attention-count");
  if (count) count.textContent = String(total).padStart(2, "0");
  const signal = document.querySelector(".signal-copy strong");
  if (signal) signal.textContent = ui(`${total} items need your attention`, `${total} пунктов требуют внимания`);
}

function isToday(value) {
  if (!value) return false;
  const today = new Date();
  const date = new Date(`${value}T00:00:00`);
  return date.toDateString() === today.toDateString();
}
function isOverdue(value) {
  if (!value) return false;
  const date = new Date(`${value}T23:59:59`);
  return !Number.isNaN(date.getTime()) && date < new Date();
}
function applyPageFilter(page, label = activeFilters[page]) {
  if (!label) return;
  const normalized = label.toLowerCase();
  if (page === "tasks") {
    document.querySelectorAll('[data-page="tasks"] .table-row, [data-page="tasks"] .record-row').forEach((row) => {
      const text = row.textContent.toLowerCase();
      const status = row.dataset.recordStatus || "";
      const date = row.dataset.recordDate || "";
      let visible = taskRowMatches(row);
      if (normalized.includes("today") || normalized.includes("сегодня")) visible = visible && (text.includes("today") || text.includes("сегодня") || isToday(date));
      if (normalized.includes("waiting") || normalized.includes("ожида")) visible = visible && (text.includes("waiting") || text.includes("ожида") || status === "waiting");
      if (normalized.includes("overdue") || normalized.includes("просроч")) visible = visible && (text.includes("overdue") || text.includes("просроч") || status === "overdue" || (taskDueDateFromRow(row) && taskDueDateFromRow(row) < new Date()));
      row.hidden = !visible;
    });
  }
  if (page === "investments") {
    const reviewMode = normalized.includes("review calendar") || normalized.includes("календарь пересмотра");
    const portfolio = document.querySelector('[data-page="investments"] .investment-layout');
    const reviewCalendar = document.getElementById("investmentReviewCalendar");
    if (portfolio) portfolio.hidden = reviewMode;
    if (reviewCalendar) reviewCalendar.hidden = !reviewMode;
    if (reviewMode) renderInvestmentReviewCalendar();
    document.querySelectorAll('[data-page="investments"] .record-row').forEach((row) => {
      let visible = true;
      if (normalized.includes("owned") || normalized.includes("влад")) visible = ["confirmed", "active"].includes(row.dataset.recordStatus);
      if (normalized.includes("proposed") || normalized.includes("предлож")) visible = row.dataset.recordStatus === "needs confirmation";
      if (normalized.includes("watchlist") || normalized.includes("наблюд")) visible = row.dataset.recordStatus === "waiting";
      row.hidden = !visible;
    });
  }
}
function applyAllPageFilters() { Object.entries(activeFilters).forEach(([page, label]) => applyPageFilter(page, label)); }
function taskItemsForCalendar() {
  const items = [...document.querySelectorAll('[data-page="tasks"] .table-row')].map((row) => ({
    name: row.querySelector("strong")?.textContent.trim() || ui("Untitled task", "Задача без названия"),
    date: taskDateFromRow(row),
    category: row.children[1]?.textContent.trim() || "",
    priority: row.classList.contains("priority-high") || row.textContent.toLowerCase().includes("priority") ? "high" : "medium",
    status: row.textContent.toLowerCase().includes("waiting") || row.textContent.toLowerCase().includes("ожида") ? "waiting" : "planned"
  }));
  return items.concat(loadRecords().filter((record) => record.type === "task").map((record) => ({ name: record.name, date: dateOnly(record.date), category: categoryLabel(record), priority: record.priority || "medium", status: record.status })));
}
function renderTaskCalendar() {
  const host = document.getElementById("taskCalendar");
  if (!host) return;
  const today = new Date();
  const isMonth = taskPlannerState.period === "month";
  const base = isMonth ? new Date(today.getFullYear(), today.getMonth() + taskPlannerState.calendarOffset, 1) : new Date(today.getFullYear(), today.getMonth(), today.getDate() + taskPlannerState.calendarOffset * 7);
  const mondayOffset = (base.getDay() + 6) % 7;
  const start = new Date(base.getFullYear(), base.getMonth(), base.getDate() - mondayOffset);
  const days = Array.from({ length: isMonth ? 42 : 7 }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
  const dayNames = locale === "ru" ? ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const items = taskItemsForCalendar().filter((item) => {
    if (!item.date) return false;
    const row = { textContent: `${item.name} ${item.category} ${item.status}`, dataset: { recordDate: item.date.toISOString().slice(0, 10), recordStatus: item.status, recordPriority: item.priority, recordCategory: item.category } };
    if (!taskRowMatches(row, { includePeriod: false })) return false;
    const normalizedFilter = (activeFilters.tasks || "All").toLowerCase();
    if (normalizedFilter.includes("today") || normalizedFilter.includes("сегодня")) return item.date.toDateString() === today.toDateString();
    if (normalizedFilter.includes("waiting") || normalizedFilter.includes("ожида")) return item.status === "waiting";
    if (normalizedFilter.includes("overdue") || normalizedFilter.includes("просроч")) return item.status === "overdue" || item.date < new Date();
    return true;
  });
  const columns = days.map((day, index) => {
    const dayItems = items.filter((item) => item.date.toDateString() === day.toDateString());
    const classes = day.toDateString() === today.toDateString() ? "task-day today" : day.getMonth() !== base.getMonth() ? "task-day outside" : "task-day";
    return `<div class="${classes}"><div class="task-day-head"><span>${dayNames[index % 7]}</span><b>${day.getDate()}</b></div>${dayItems.length ? dayItems.map((item) => `<div class="calendar-task ${item.priority}"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.category || statusLabel(item.status))}</small></div>`).join("") : `<div class="task-day-empty">—</div>`}</div>`;
  }).join("");
  const unscheduled = taskItemsForCalendar().filter((item) => !item.date);
  const periodLabel = isMonth ? ui("CURRENT MONTH", "ТЕКУЩИЙ МЕСЯЦ") : ui("CURRENT WEEK", "ТЕКУЩАЯ НЕДЕЛЯ");
  const heading = isMonth ? base.toLocaleDateString(locale === "ru" ? "ru-RU" : "en-US", { month: "long", year: "numeric" }) : `${start.toLocaleDateString(locale === "ru" ? "ru-RU" : "en-US", { day: "numeric", month: "long" })} — ${days[6].toLocaleDateString(locale === "ru" ? "ru-RU" : "en-US", { day: "numeric", month: "long" })}`;
  host.innerHTML = `<div class="calendar-heading"><div><span class="panel-kicker">${periodLabel}</span><h2>${heading}</h2></div><div class="calendar-controls"><button class="small-button" data-task-calendar-shift="-1" aria-label="${ui("Previous period", "Предыдущий период")}">←</button><button class="small-button" data-task-calendar-shift="0">${ui("Today", "Сегодня")}</button><button class="small-button" data-task-calendar-shift="1" aria-label="${ui("Next period", "Следующий период")}">→</button><span class="muted-text">${items.length} ${ui("scheduled", "запланировано")}</span></div></div><div class="task-calendar-grid ${isMonth ? "month-grid" : ""}">${columns}</div>${unscheduled.length ? `<div class="unscheduled-tasks"><span class="panel-kicker">${ui("NO DATE", "БЕЗ ДАТЫ")}</span>${unscheduled.map((item) => `<span>${escapeHtml(item.name)}</span>`).join("")}</div>` : ""}`;
}
function setTaskLayout(layout) {
  taskPlannerState.layout = layout;
  document.querySelectorAll("[data-task-layout]").forEach((button) => button.classList.toggle("selected", button.dataset.taskLayout === layout));
  const list = document.getElementById("taskListView");
  const calendar = document.getElementById("taskCalendar");
  if (list) list.hidden = layout === "calendar";
  if (calendar) calendar.hidden = layout !== "calendar";
  if (layout === "calendar") renderTaskCalendar();
}
document.querySelectorAll("[data-task-layout]").forEach((button) => button.addEventListener("click", () => setTaskLayout(button.dataset.taskLayout)));
document.querySelectorAll("[data-task-period]").forEach((button) => button.addEventListener("click", () => {
  taskPlannerState.period = button.dataset.taskPeriod;
  taskPlannerState.calendarOffset = 0;
  document.querySelectorAll("[data-task-period]").forEach((item) => item.classList.toggle("selected", item === button));
  applyPageFilter("tasks", activeFilters.tasks || "All");
  if (taskPlannerState.layout === "calendar") renderTaskCalendar();
}));
document.addEventListener("click", (event) => {
  const shiftButton = event.target.closest("[data-task-calendar-shift]");
  if (!shiftButton) return;
  const shift = Number(shiftButton.dataset.taskCalendarShift);
  taskPlannerState.calendarOffset = shift === 0 ? 0 : taskPlannerState.calendarOffset + shift;
  renderTaskCalendar();
});
document.getElementById("taskPriorityFilter")?.addEventListener("change", (event) => { taskPlannerState.priority = event.target.value; applyPageFilter("tasks", activeFilters.tasks || "All"); if (taskPlannerState.layout === "calendar") renderTaskCalendar(); });
document.getElementById("taskTypeFilter")?.addEventListener("change", (event) => { taskPlannerState.type = event.target.value; applyPageFilter("tasks", activeFilters.tasks || "All"); if (taskPlannerState.layout === "calendar") renderTaskCalendar(); });
document.getElementById("todayTaskMenu")?.addEventListener("click", () => { showView("tasks"); document.getElementById("taskPlanner")?.scrollIntoView({ behavior: "smooth", block: "start" }); showToast(ui("Task planner opened.", "Планировщик задач открыт.")); });
function ensureDynamicHost(id, parentSelector) {
  if (document.getElementById(id)) return;
  const parent = document.querySelector(parentSelector);
  if (!parent) return;
  const host = document.createElement("div");
  host.id = id;
  host.className = "record-list dynamic-record-host";
  parent.appendChild(host);
}
function verifiedRecord(record) {
  return ["confirmed", "active"].includes(record.status) && Number.isFinite(Number(record.amount));
}
function totalByCurrency(records) {
  const totals = new Map();
  records.filter(verifiedRecord).forEach((record) => totals.set(record.currency || "RUB", (totals.get(record.currency || "RUB") || 0) + Number(record.amount)));
  return totals;
}
function formatTotals(records) {
  const totals = totalByCurrency(records);
  if (!totals.size) return "—";
  return [...totals.entries()].map(([currency, amount]) => `${amount.toLocaleString(locale === "ru" ? "ru-RU" : "en-US")} ${currency}`).join(" · ");
}
function renderCapitalMetrics(records = loadRecords()) {
  const capital = records.filter((record) => ["account", "investment", "asset", "property", "business"].includes(record.type));
  const accounts = capital.filter((record) => record.type === "account");
  const investments = capital.filter((record) => record.type === "investment");
  const property = capital.filter((record) => ["asset", "property", "business"].includes(record.type));
  const receivables = records.filter((record) => ["receivable", "debt"].includes(record.type) && record.category === "receivable");
  const payables = records.filter((record) => ["payable", "debt"].includes(record.type) && ["payable", "mortgage"].includes(record.category));
  const netWorthRecords = [...capital, ...receivables, ...payables.map((record) => ({ ...record, amount: -Number(record.amount || 0) }))];
  const netWorthTotal = formatTotals(netWorthRecords);
  const set = (id, value, page, label, secondary = false) => {
    let node = document.getElementById(id);
    if (!node && page) {
      const card = [...document.querySelectorAll(`[data-page="${page}"] .metric-card`)].find((item) => [label, ru[label]].includes(item.querySelector(".panel-kicker")?.textContent.trim()));
      node = card?.querySelector(secondary ? "small" : "strong");
    }
    if (node) node.textContent = value;
  };
  set("capitalLiquid", formatTotals(accounts), "capital", "LIQUID");
  set("capitalDebt", formatTotals(payables), "capital", "DEBT");
  set("capitalNetWorth", netWorthTotal, "capital", "NET WORTH");
  set("capitalLiquidMeta", `${accounts.filter(verifiedRecord).length} ${ui("verified accounts", "подтверждённых счетов")}`, "capital", "LIQUID", true);
  set("capitalDebtMeta", `${payables.filter(verifiedRecord).length} ${ui("verified liabilities", "подтверждённых обязательств")}`, "capital", "DEBT", true);
  const verified = capital.filter(verifiedRecord).length;
  set("capitalConfidence", capital.length ? `${Math.round((verified / capital.length) * 100)}%` : "—", "capital", "CONFIDENCE");
  set("capitalConfidenceMeta", capital.length ? ui("based on record status", "по статусам записей") : ui("No source connected", "Источник не подключён"), "capital", "CONFIDENCE", true);
  const snapshot = document.querySelector('[data-page="command"] .allocation-placeholder .allocation-ring span');
  if (snapshot) snapshot.textContent = formatTotals(capital);
  const commandNetWorth = document.querySelector('[data-page="command"] .capital-panel .net-worth-line strong');
  if (commandNetWorth) commandNetWorth.textContent = netWorthTotal;
  const commandBadge = document.querySelector('[data-page="command"] .capital-panel .net-worth-line .pending-badge');
  if (commandBadge) commandBadge.textContent = netWorthTotal === "—" ? ui("Add your first snapshot", "Добавьте первый снимок") : ui("Confirmed records only", "Только подтверждённые записи");
  const commandSubtitle = document.querySelector('[data-page="command"] .capital-panel .privacy-subtitle');
  if (commandSubtitle) commandSubtitle.textContent = netWorthTotal === "—" ? ui("No personal balances are loaded. Your data stays yours.", "Личные балансы ещё не загружены. Ваши данные остаются у вас.") : ui("Values shown from confirmed local records.", "Показаны подтверждённые локальные записи.");
  const commandAsOf = document.querySelector('[data-page="command"] .capital-panel .as-of');
  if (commandAsOf) commandAsOf.textContent = netWorthTotal === "—" ? ui("As of today · USD", "На сегодня · USD") : ui(`As of today · ${netWorthTotal.split(" ").pop()}`, `На сегодня · ${netWorthTotal.split(" ").pop()}`);
  const commandConfidence = document.querySelector('[data-page="command"] .capital-panel .confidence-label');
  if (commandConfidence) commandConfidence.innerHTML = `<span class="status-dot ${capital.length && capital.filter(verifiedRecord).length ? "green" : "amber-dot"}"></span>${capital.length ? `${ui("Confidence", "Уверенность")}: ${Math.round((capital.filter(verifiedRecord).length / capital.length) * 100)}%` : ui("Awaiting verified data", "Ожидаются подтверждённые данные")}`;
  const heading = document.querySelector('[data-page="capital"] .page-heading');
  if (heading && !heading.querySelector('[data-action="take-snapshot"]')) {
    const actions = heading.querySelector(".button-row") || heading;
    const button = document.createElement("button");
    button.className = "ghost-button";
    button.dataset.action = "take-snapshot";
    button.textContent = `＋ ${ui("Take snapshot", "Сохранить снимок")}`;
    button.addEventListener("click", takeCapitalSnapshot);
    actions.insertBefore(button, actions.firstChild);
  }
  renderSnapshotHistory(records);
}
function renderSnapshotHistory(records = loadRecords()) {
  const page = document.querySelector('[data-page="capital"]');
  const layout = page?.querySelector(".capital-layout");
  if (!page || !layout) return;
  let host = document.getElementById("capitalSnapshots");
  if (!host) {
    host = document.createElement("section");
    host.id = "capitalSnapshots";
    host.className = "panel snapshot-panel";
    layout.after(host);
  }
  const snapshots = records.filter((record) => record.type === "snapshot").slice(-5).reverse();
  host.innerHTML = `<div class="panel-header"><div><span class="panel-kicker">${ui("SNAPSHOT HISTORY", "ИСТОРИЯ СНИМКОВ")}</span><h2>${ui("Capital snapshots", "Снимки капитала")}</h2></div><span class="security-badge">${ui("Confirmed only", "Только подтверждённые")}</span></div>${snapshots.length ? `<div class="snapshot-list">${snapshots.map((record) => `<div class="snapshot-row"><span><strong>${escapeHtml(record.date || record.name)}</strong><small>${escapeHtml(record.source || ui("Derived from confirmed records", "Сформировано из подтверждённых записей"))}</small></span><b>${escapeHtml(record.amount === null ? (record.details || "—") : formatRecordAmount(record))}</b></div>`).join("")}</div>` : `<p class="snapshot-empty">${ui("No snapshots yet.", "Снимков пока нет.")} ${ui("Snapshot uses confirmed records only.", "Снимок использует только подтверждённые записи.")}</p>`}`;
}
function takeCapitalSnapshot() {
  const records = loadRecords();
  const eligible = records.filter((record) => ["account", "investment", "asset", "property", "business", "receivable", "payable", "debt"].includes(record.type) && verifiedRecord(record));
  if (!eligible.length) { showToast(ui("Add at least one confirmed capital record first.", "Сначала добавьте хотя бы одну подтверждённую запись капитала.")); return; }
  const totals = new Map();
  eligible.forEach((record) => {
    const isPayable = record.type === "payable" || (record.type === "debt" && ["payable", "mortgage"].includes(record.category));
    const currency = record.currency || "RUB";
    totals.set(currency, (totals.get(currency) || 0) + (isPayable ? -1 : 1) * Number(record.amount));
  });
  const entries = [...totals.entries()];
  const date = new Date().toISOString().slice(0, 10);
  const snapshot = { id: globalThis.crypto?.randomUUID?.() || `snapshot-${Date.now()}`, type: "snapshot", category: "net_worth", name: `${ui("Capital snapshot", "Снимок капитала")} · ${date}`, counterparty: "", amount: entries.length === 1 ? entries[0][1] : null, currency: entries.length === 1 ? entries[0][0] : "RUB", date, terms: `${eligible.length} ${ui("confirmed records", "подтверждённых записей")}`, owner: "Me", source: ui("Derived from confirmed records", "Сформировано из подтверждённых записей"), confidence: "high", reminderDate: null, linkedRecordId: null, details: entries.map(([currency, amount]) => `${amount.toLocaleString(locale === "ru" ? "ru-RU" : "en-US")} ${currency}`).join(" · "), status: "confirmed", priority: "medium", attachment: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  saveRecords([...records, snapshot]);
  addAuditEvent("created", snapshot);
  refreshDynamicSurfaces();
  showToast(ui("Capital snapshot saved.", "Снимок капитала сохранён."));
}
function renderCashflowMetrics(records = loadRecords()) {
  const periodRecords = cashflowRecordsForPeriod(records);
  const income = periodRecords.filter((record) => record.type === "income");
  const expenses = periodRecords.filter((record) => record.type === "expense");
  const incomeTotal = formatTotals(income);
  const expenseTotal = formatTotals(expenses);
  const netTotal = formatTotals([...income, ...expenses.map((record) => ({ ...record, amount: -Number(record.amount || 0) }))]);
  const set = (id, value, label, secondary = false) => {
    let node = document.getElementById(id);
    if (!node) {
      const card = [...document.querySelectorAll('[data-page="cashflow"] .metric-card')].find((item) => [label, ru[label]].includes(item.querySelector(".panel-kicker")?.textContent.trim()));
      node = card?.querySelector(secondary ? "small" : "strong");
    }
    if (node) node.textContent = value;
  };
  set("cashflowIncome", incomeTotal, "INCOME");
  set("cashflowExpenses", expenseTotal, "EXPENSES");
  set("cashflowNet", netTotal, "NET FLOW");
  set("cashflowIncomeMeta", `${income.filter(verifiedRecord).length} ${ui("confirmed entries", "подтверждённых записей")}`, "INCOME", true);
  set("cashflowExpensesMeta", `${expenses.filter(verifiedRecord).length} ${ui("confirmed entries", "подтверждённых записей")}`, "EXPENSES", true);
  set("cashflowNetMeta", netTotal !== "—" ? ui("income minus expenses", "доходы минус расходы") : ui("Waiting for a period", "Ожидается период"), "NET FLOW", true);
  set("cashflowPeriod", ui("This month", "Этот месяц"), "PERIOD");
}
function refreshDynamicSurfaces() {
  const records = loadRecords();
  renderUploadedFiles(records);
  renderCashflowEntries(records);
  renderDynamicRecords(records);
  updateTaskFilterCounts();
  renderCapitalMetrics(records);
  renderCashflowMetrics(records);
  applyAllPageFilters();
  if (taskPlannerState.layout === "calendar") renderTaskCalendar();
}
refreshDynamicSurfaces();

let deferredInstallPrompt = null;
function ensureInstallPanel() {
  const settingsPage = document.querySelector('[data-page="settings"]');
  const cloudPanel = settingsPage?.querySelector(".cloud-panel");
  if (!settingsPage || !cloudPanel || document.getElementById("installAppPanel")) return;
  const panel = document.createElement("section");
  panel.id = "installAppPanel";
  panel.className = "panel install-app-panel";
  panel.innerHTML = `<div><span class="panel-kicker">${ui("PHONE & COMPUTER", "ТЕЛЕФОН И КОМПЬЮТЕР")}</span><h2>${ui("Install Nik'Os on this device", "Установить Nik'Os на это устройство")}</h2><p>${ui("Open Nik'Os from your home screen. Your records stay synchronized through your Supabase account.", "Запускайте Nik'Os с главного экрана. Записи синхронизируются через ваш аккаунт Supabase.")}</p><small id="installAppHint">${ui("On iPhone, use Share → Add to Home Screen. On Android or desktop, use the install button when available.", "На iPhone нажмите «Поделиться» → «На экран Домой». На Android или компьютере используйте кнопку установки, когда она доступна.")}</small></div><button class="primary-button" id="installAppButton" type="button" disabled>${ui("Installation is available from the browser menu", "Установка доступна через меню браузера")}</button>`;
  cloudPanel.before(panel);
  document.getElementById("installAppButton")?.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    await deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    updateInstallButton();
  });
}
function updateInstallButton() {
  const button = document.getElementById("installAppButton");
  if (!button) return;
  const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  button.disabled = standalone || !deferredInstallPrompt;
  button.textContent = standalone ? ui("Nik'Os is installed", "Nik'Os уже установлен") : deferredInstallPrompt ? ui("Install Nik'Os", "Установить Nik'Os") : ui("Installation is available from the browser menu", "Установка доступна через меню браузера");
}
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  ensureInstallPanel();
  updateInstallButton();
});
window.addEventListener("appinstalled", () => { deferredInstallPrompt = null; updateInstallButton(); showToast(ui("Nik'Os was installed.", "Nik'Os установлен.")); });
ensureInstallPanel();
updateInstallButton();

if ("serviceWorker" in navigator && ["http:", "https:"].includes(location.protocol)) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {
    showToast(ui("Offline mode could not be enabled.", "Не удалось включить офлайн-режим."));
  }));
}

function recordView(type) {
  return { account: "capital", receivable: "debts", payable: "debts", debt: "debts", income: "cashflow", expense: "cashflow", investment: "investments", crypto: "crypto", asset: "assets", property: "assets", business: "assets", document: "documents", health: "health", person: "people", decision: "decisions", event: "timeline", task: "tasks", project: "projects", note: "inbox", snapshot: "capital" }[type] || "command";
}
async function deleteRecordFromCloud(recordId) {
  if (!cloudClient || !cloudUser || !localStorage.getItem("nikos-cloud-consent")) return;
  const { error } = await cloudClient.from("nikos_records").delete().eq("user_id", cloudUser.id).eq("record_id", recordId);
  if (error) showCloudFailure(error.message);
}
document.addEventListener("click", (event) => {
  const actionButton = event.target.closest("[data-record-action]");
  if (!actionButton) return;
  event.preventDefault();
  const id = actionButton.dataset.recordId;
  const record = loadRecords().find((item) => item.id === id);
  if (!record) return;
  const action = actionButton.dataset.recordAction;
  if (action === "edit") { openDataForm(record.type, record); return; }
  if (action === "archive") {
    const archived = { ...record, status: "archived", updatedAt: new Date().toISOString() };
    saveRecords(loadRecords().map((item) => item.id === id ? archived : item));
    addAuditEvent("archived", archived);
    refreshDynamicSurfaces();
    void syncRecordToCloud(archived);
    showToast(ui("Record archived.", "Запись отправлена в архив."));
    return;
  }
  if (action === "delete" && window.confirm(ui("Delete this record?", "Удалить эту запись?"))) {
    saveRecords(loadRecords().filter((item) => item.id !== id));
    addAuditEvent("deleted", record);
    refreshDynamicSurfaces();
    void deleteRecordFromCloud(id);
    showToast(ui("Record deleted.", "Запись удалена."));
  }
});

/* Optional Supabase sync: local-first until the owner explicitly connects and consents. */
const cloudConfigKey = "nikos-cloud-config";
let cloudClient = null;
let cloudUser = null;
function loadCloudConfig() {
  try { return JSON.parse(localStorage.getItem(cloudConfigKey) || "null"); } catch { return null; }
}
const cloudDraftKey = "nikos-cloud-draft";
function saveCloudDraft() {
  try {
    localStorage.setItem(cloudDraftKey, JSON.stringify({
      url: document.getElementById("supabaseUrl")?.value.trim() || "",
      key: document.getElementById("supabaseAnonKey")?.value.trim() || "",
      email: document.getElementById("cloudEmail")?.value.trim() || ""
    }));
  } catch { /* Draft persistence is optional. */ }
}
function restoreCloudDraft() {
  try {
    const draft = JSON.parse(localStorage.getItem(cloudDraftKey) || "null");
    if (!draft) return;
    const url = document.getElementById("supabaseUrl");
    const key = document.getElementById("supabaseAnonKey");
    const email = document.getElementById("cloudEmail");
    if (url && !url.value) url.value = draft.url || "";
    if (key && !key.value) key.value = draft.key || "";
    if (email && !email.value) email.value = draft.email || "";
  } catch { /* Draft persistence is optional. */ }
}
function ensureRecordId(record) {
  if (record.id) return record;
  return { ...record, id: (globalThis.crypto?.randomUUID?.() || `nikos-${Date.now()}-${Math.random().toString(36).slice(2)}`) };
}
function saveRecords(records) {
  try { localStorage.setItem("nikos-records", JSON.stringify(records)); } catch { /* Local storage is optional. */ }
}
function setCloudStatus(state) {
  const node = document.getElementById("cloudStatus");
  const labels = {
    setup: ["Not connected", "Не подключено"],
    ready: ["Ready to connect", "Готово к подключению"],
    syncing: ["Syncing…", "Синхронизация…"],
    connected: ["Connected", "Подключено"],
    error: ["Check connection", "Проверьте подключение"]
  };
  if (node) node.textContent = ui(...(labels[state] || labels.setup));
  const signOut = document.getElementById("cloudSignOut");
  if (signOut) signOut.hidden = state !== "connected";
}
function setCloudError(en, ruText = en) {
  const node = document.getElementById("cloudError");
  if (node) node.textContent = locale === "ru" ? ruText : en;
}
function showCloudFailure(message, fallback = "Unknown Supabase error") {
  const detail = String(message || fallback).trim();
  setCloudStatus("error");
  setCloudError(`Supabase: ${detail}`, `Supabase: ${detail}`);
  showToast(ui("Cloud sync failed; local copy is safe.", "Сбой облачной синхронизации; локальная копия сохранена."));
}
function cloudRows(records, userId) {
  return records.map((record) => {
    const normalized = ensureRecordId(record);
    const updatedAt = normalized.updatedAt || new Date().toISOString();
    return { user_id: userId, record_id: normalized.id, record_type: normalized.type, payload: normalized, updated_at: updatedAt };
  });
}
async function syncRecordToCloud(record) {
  if (!cloudClient || !cloudUser || !localStorage.getItem("nikos-cloud-consent")) return;
  const normalized = ensureRecordId(record);
  const { error } = await cloudClient.from("nikos_records").upsert(cloudRows([normalized], cloudUser.id), { onConflict: "user_id,record_id" });
  if (error) showCloudFailure(error.message);
}
async function syncAllCloudRecords() {
  if (!cloudClient || !cloudUser) return;
  setCloudStatus("syncing");
  const localRecords = loadRecords().map(ensureRecordId);
  const remote = await cloudClient.from("nikos_records").select("record_id,payload,updated_at").order("updated_at", { ascending: false });
  if (remote.error) { showCloudFailure(remote.error.message, "Records could not be loaded"); return; }
  const merged = new Map(localRecords.map((record) => [record.id, record]));
  (remote.data || []).forEach((row) => {
    const remoteRecord = row.payload?.id ? { ...row.payload, updatedAt: row.payload.updatedAt || row.updated_at } : null;
    if (!remoteRecord) return;
    const localRecord = merged.get(remoteRecord.id);
    const localTime = new Date(localRecord?.updatedAt || 0).getTime();
    const remoteTime = new Date(remoteRecord.updatedAt || 0).getTime();
    if (!localRecord || remoteTime > localTime) merged.set(remoteRecord.id, remoteRecord);
  });
  const mergedRecords = [...merged.values()];
  saveRecords(mergedRecords);
  const upload = await cloudClient.from("nikos_records").upsert(cloudRows(mergedRecords, cloudUser.id), { onConflict: "user_id,record_id" });
  if (upload.error) { showCloudFailure(upload.error.message); return; }
  refreshDynamicSurfaces();
  setCloudStatus("connected");
  showToast(ui("Nik'Os is synced automatically.", "Nik'Os синхронизируется автоматически."));
}
function configureCloudClient() {
  const url = document.getElementById("supabaseUrl")?.value.trim();
  const key = document.getElementById("supabaseAnonKey")?.value.trim();
  if (!url || !key || !window.supabase?.createClient) return false;
  try {
    cloudClient = window.supabase.createClient(url, key);
    localStorage.setItem(cloudConfigKey, JSON.stringify({ url, key }));
    return true;
  } catch { setCloudStatus("error"); return false; }
}
async function connectCloud(createAccount = false) {
  setCloudError("", "");
  if (!document.getElementById("cloudConsent")?.checked) { setCloudError("Tick the confirmation box before connecting.", "Поставьте галочку согласия перед подключением."); showToast(ui("Confirm cloud sync before connecting.", "Подтвердите синхронизацию перед подключением.")); return; }
  const email = document.getElementById("cloudEmail")?.value.trim();
  const password = document.getElementById("cloudPassword")?.value;
  if (!window.supabase?.createClient) { setCloudStatus("error"); setCloudError("The Supabase library did not load. Refresh the page and check your internet connection.", "Библиотека Supabase не загрузилась. Обновите страницу и проверьте интернет-соединение."); showToast(ui("Supabase is not ready yet.", "Supabase ещё не готов.")); return; }
  if (!configureCloudClient() || !email || !password) { setCloudError("Fill in the project URL, publishable key, email, and account password.", "Заполните URL проекта, publishable key, email и пароль аккаунта."); showToast(ui("Complete all connection fields.", "Заполните все поля подключения.")); return; }
  localStorage.setItem("nikos-cloud-consent", "true");
  const result = createAccount ? await cloudClient.auth.signUp({ email, password }) : await cloudClient.auth.signInWithPassword({ email, password });
  if (result.error) { setCloudStatus("error"); setCloudError(result.error.message, result.error.message); showToast(result.error.message); return; }
  cloudUser = result.data.session?.user || null;
  if (!cloudUser) { setCloudStatus("ready"); showToast(ui("Check your email to finish account setup, then connect again.", "Проверьте email для завершения регистрации, затем подключитесь снова.")); return; }
  setCloudStatus("connected");
  await syncAllCloudRecords();
}
async function initCloud() {
  restoreCloudDraft();
  const config = loadCloudConfig();
  if (!config || !window.supabase?.createClient) { setCloudStatus(config ? "ready" : "setup"); return; }
  const urlField = document.getElementById("supabaseUrl");
  const keyField = document.getElementById("supabaseAnonKey");
  if (urlField) urlField.value = config.url || "";
  if (keyField) keyField.value = config.key || "";
  if (!configureCloudClient()) return;
  cloudClient.auth.onAuthStateChange((_event, session) => { cloudUser = session?.user || null; setCloudStatus(cloudUser ? "connected" : "ready"); });
  const sessionResult = await cloudClient.auth.getSession();
  cloudUser = sessionResult.data.session?.user || null;
  setCloudStatus(cloudUser ? "connected" : "ready");
  if (cloudUser && localStorage.getItem("nikos-cloud-consent")) await syncAllCloudRecords();
}
document.getElementById("cloudConnect")?.addEventListener("click", () => { void connectCloud(false); });
document.getElementById("cloudSignUp")?.addEventListener("click", () => { void connectCloud(true); });
document.getElementById("cloudSignOut")?.addEventListener("click", async () => { if (cloudClient) await cloudClient.auth.signOut(); cloudUser = null; setCloudStatus("ready"); showToast(ui("Signed out. Local records remain on this device.", "Вы вышли. Локальные записи остались на этом устройстве.")); });
document.querySelectorAll("#supabaseUrl, #supabaseAnonKey, #cloudEmail").forEach((input) => input.addEventListener("input", saveCloudDraft));
void initCloud();

const searchBackdrop = document.getElementById("searchBackdrop");
const globalSearch = document.getElementById("globalSearch");
const searchResults = document.getElementById("searchResults");
const searchIndex = [
  ["Command Center", "Overview", "command"], ["AI Inbox", "Capture and review", "inbox"], ["Tasks", "Work management", "tasks"], ["Projects", "Outcomes in motion", "projects"], ["Capital", "Personal CFO", "capital"], ["Debts", "Receivables and payables", "debts"], ["Investments", "Owned, proposed, watchlist", "investments"], ["Crypto", "Observed only", "crypto"], ["Assets", "Property, vehicles, business", "assets"], ["Health", "Health, routines, signals", "health"], ["Documents", "Private vault", "documents"], ["People", "Relationship context", "people"], ["Decisions", "Thesis and review", "decisions"], ["Timeline", "The long view", "timeline"], ["Settings", "Control and privacy", "settings"], ["Personal operating system", "Project · 18%", "projects"], ["Property records", "Project · waiting for documents", "projects"], ["Review the open decisions", "Task · today", "tasks"]
];
function renderSearchResults(query = "") {
  const normalized = query.trim().toLowerCase();
  const matches = searchIndex.filter(([name, meta]) => !normalized || `${name} ${meta}`.toLowerCase().includes(normalized)).map(([name, meta, view]) => ({ name, meta, view }));
  const localMatches = loadRecords().filter((record) => !normalized || `${record.name} ${record.details || ""} ${record.counterparty || ""} ${record.source || ""} ${record.owner || ""} ${record.date || ""} ${record.reminderDate || ""}`.toLowerCase().includes(normalized)).slice(0, 6).map((record) => ({ name: record.name, meta: `${categoryLabel(record)} · ${statusLabel(record.status)}`, view: recordView(record.type) }));
  const allMatches = [...matches, ...localMatches].slice(0, 10);
  if (!allMatches.length) { searchResults.innerHTML = `<div class="search-hint">${ui("No matching records yet.", "Совпадений пока нет.")}</div>`; return; }
  searchResults.innerHTML = allMatches.map(({ name, meta, view }) => `<button class="search-result" data-search-view="${escapeHtml(view)}"><span><strong>${escapeHtml(locale === "ru" ? (ru[name] || name) : name)}</strong><small>${escapeHtml(locale === "ru" ? (ru[meta] || meta) : meta)}</small></span><span>↗</span></button>`).join("");
  searchResults.querySelectorAll("[data-search-view]").forEach((item) => item.addEventListener("click", () => { showView(item.dataset.searchView); closeSearch(); }));
}
function openSearch() { searchBackdrop.classList.add("open"); searchBackdrop.setAttribute("aria-hidden", "false"); globalSearch.value = ""; renderSearchResults(); setTimeout(() => globalSearch.focus(), 20); }
function closeSearch() { searchBackdrop.classList.remove("open"); searchBackdrop.setAttribute("aria-hidden", "true"); }
document.getElementById("searchTrigger")?.addEventListener("click", openSearch);
document.getElementById("closeSearch")?.addEventListener("click", closeSearch);
searchBackdrop?.addEventListener("click", (event) => { if (event.target === searchBackdrop) closeSearch(); });
globalSearch?.addEventListener("input", () => renderSearchResults(globalSearch.value));
document.addEventListener("keydown", (event) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); openSearch(); } if (event.key === "Escape") { closeSearch(); closeDataForm(); } });

function ensureCsvPicker() {
  let picker = document.getElementById("healthCsvPicker");
  if (picker) return picker;
  picker = document.createElement("input");
  picker.id = "healthCsvPicker";
  picker.type = "file";
  picker.accept = ".csv,text/csv";
  picker.hidden = true;
  picker.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => importCsvLocally(file, String(reader.result || ""));
    reader.readAsText(file);
    event.target.value = "";
  });
  document.body.appendChild(picker);
  return picker;
}
function parseCsvLine(line, separator = ",") {
  const cells = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && line[index + 1] === '"' && quoted) { cell += '"'; index += 1; continue; }
    if (character === '"') { quoted = !quoted; continue; }
    if (character === separator && !quoted) { cells.push(cell.trim()); cell = ""; continue; }
    cell += character;
  }
  cells.push(cell.trim());
  return cells;
}
function inferHealthCsvCategory(headers, filename) {
  const text = `${headers.join(" ")} ${filename}`.toLowerCase();
  if (/diagnos|condition|medical|medic|болезн|анализ|обслед/.test(text)) return "condition";
  if (/sleep|сон/.test(text)) return "routine";
  if (/recover|восстанов|hrv/.test(text)) return "checkup";
  if (/strain|workout|training|трен|нагруз/.test(text)) return "fitness";
  if (/weight|вес|мас[сс]/.test(text)) return "fitness";
  return "other";
}
function importCsvLocally(file, csvText) {
  const lines = csvText.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) { showToast(ui("The CSV needs a header and at least one row.", "В CSV нужны заголовок и хотя бы одна строка.")); return; }
  const separator = lines[0].includes(";") && !lines[0].includes(",") ? ";" : ",";
  const headers = parseCsvLine(lines[0], separator);
  const sourceText = `${file.name} ${headers.join(" ")}`.toLowerCase();
  const healthSource = /whoop|oura|scale|weight|sleep|recovery|strain|hrv|health|diagnos|condition|medical|medic|болезн|анализ|обслед|сон|вес|трен/.test(sourceText);
  const dateIndex = headers.findIndex((header) => /date|time|дата|время/i.test(header));
  const category = inferHealthCsvCategory(headers, file.name);
  const rows = lines.slice(1, 1001).map((line, index) => {
    const values = parseCsvLine(line, separator);
    const detail = headers.map((header, headerIndex) => values[headerIndex] ? `${header}: ${values[headerIndex]}` : "").filter(Boolean).join(" · ");
    const numeric = values.find((value, valueIndex) => value && valueIndex !== dateIndex && /^-?\d+(?:[.,]\d+)?$/.test(value.replace(/\s/g, "")));
    const dateValue = dateIndex >= 0 ? values[dateIndex] : "";
    const sourceLabel = file.name.replace(/\.csv$/i, "");
    return { id: globalThis.crypto?.randomUUID?.() || `csv-${Date.now()}-${index}`, type: healthSource ? "health" : "note", category: healthSource ? category : "other", name: `${sourceLabel} · ${healthSource ? (categoryLabel({ type: "health", category }) || "Signal") : "Import"} ${index + 1}`, counterparty: file.name, source: file.name, amount: healthSource ? null : (numeric ? Number(numeric.replace(",", ".")) : null), currency: healthSource ? null : "RUB", date: /^\d{4}-\d{2}-\d{2}$/.test(dateValue) ? dateValue : null, terms: "CSV import · needs confirmation", owner: "Me", details: detail || line, status: "needs confirmation", priority: "medium", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  });
  if (!rows.length) { showToast(ui("No CSV rows could be imported.", "Не удалось импортировать строки CSV.")); return; }
  if (!window.confirm(ui(`Add ${rows.length} unverified records from ${file.name}?`, `Добавить ${rows.length} непроверенных записей из файла ${file.name}?`))) return;
  saveRecords([...loadRecords(), ...rows]);
  addAuditEvent("imported", { id: `csv-${Date.now()}`, type: healthSource ? "health" : "note", name: `${file.name} · ${rows.length} ${ui("rows", "строк")}` });
  refreshDynamicSurfaces();
  showToast(healthSource ? ui(`${rows.length} health signals saved locally for review.`, `${rows.length} показателей здоровья сохранено локально для проверки.`) : ui(`${rows.length} CSV rows saved locally for review.`, `${rows.length} строк CSV сохранено локально для проверки.`));
}
document.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", () => {
  const action = button.dataset.action;
  if (action === "import-csv") ensureCsvPicker().click();
  if (action === "audit") showToast(ui("Audit history is enabled for every confirmed change.", "Аудит включён для каждого подтверждённого изменения."));
  if (action === "export-data") {
    const payload = { product: "Nik'Os", schemaVersion: 2, exportedAt: new Date().toISOString(), preferences: { theme: document.body.dataset.theme || "dark", locale }, records: loadRecords(), audit: loadAudit() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `nikos-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    showToast(ui("Backup downloaded to your device.", "Резервная копия скачана на устройство."));
  }
  if (action === "import-data") document.getElementById("backupPicker")?.click();
}));

document.getElementById("backupPicker")?.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      const records = Array.isArray(parsed) ? parsed : parsed.records;
      if (parsed?.product && parsed.product !== "Nik'Os") throw new Error("Wrong product");
      if (!Array.isArray(records) || records.some((record) => !record || typeof record.name !== "string" || typeof record.type !== "string")) throw new Error("Invalid backup");
      if (loadRecords().length && !window.confirm(ui("Replace the current local records with this backup?", "Заменить текущие локальные записи этой резервной копией?"))) return;
      const normalized = records.map((record) => ensureRecordId({ ...record, updatedAt: record.updatedAt || record.createdAt || new Date().toISOString() }));
      saveRecords(normalized);
      if (Array.isArray(parsed?.audit)) saveAudit(parsed.audit);
      addAuditEvent("imported", { id: `backup-${Date.now()}`, type: "backup", name: `${normalized.length} ${ui("records", "записей")}` });
      refreshDynamicSurfaces();
      if (cloudUser) void syncAllCloudRecords();
      showToast(ui(`Imported ${normalized.length} records.`, `Импортировано записей: ${normalized.length}.`));
    } catch {
      showToast(ui("That backup file could not be read.", "Не удалось прочитать этот файл резервной копии."));
    }
    event.target.value = "";
  };
  reader.readAsText(file);
});
