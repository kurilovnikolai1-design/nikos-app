/* Keys, not text-node scanning. The old translator walked every text node in
   the document and replaced anything matching a dictionary entry, which meant
   a record the owner named "Задачи" was silently rewritten to "Tasks".
   Here nothing touches user data: only these keys are ever translated. */

import { STATUS, PRIORITY, CONFIDENCE, OWNER, FREQUENCY, TYPES } from "./schema.js?v=20260827-061621";

const LOCALE_KEY = "nikos-locale";
let locale = "ru";

const listeners = new Set();
export const onLocaleChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const getLocale = () => locale;
export const localeTag = () => (locale === "ru" ? "ru-RU" : "en-US");

export function setLocale(next) {
  locale = next === "en" ? "en" : "ru";
  document.documentElement.lang = locale;
  try { localStorage.setItem(LOCALE_KEY, locale); } catch { /* preference only */ }
  listeners.forEach((fn) => fn(locale));
}

export function initLocale() {
  let saved = null;
  try { saved = localStorage.getItem(LOCALE_KEY); } catch { /* preference only */ }
  locale = saved === "en" ? "en" : "ru";
  document.documentElement.lang = locale;
  return locale;
}

const DICT = {
  /* Chrome */
  "app.workspace": { ru: "Рабочее пространство", en: "Workspace" },
  "app.privateWorkspace": { ru: "Личное пространство", en: "Private workspace" },
  "app.ownerView": { ru: "Вид владельца", en: "Owner view" },
  "app.controlRoom": { ru: "личная операционная", en: "personal control room" },
  "app.search": { ru: "Искать что угодно", en: "Search anything" },
  "app.searchPlaceholder": { ru: "Задачи, деньги, документы, люди, здоровье…", en: "Tasks, money, documents, people, health…" },
  "app.searchEmpty": { ru: "Ничего не нашлось.", en: "Nothing found." },
  "app.searchHint": { ru: "Начните печатать — ищем по всем записям.", en: "Start typing — every record is searched." },
  "app.notifications": { ru: "Уведомления", en: "Notifications" },
  "app.openNav": { ru: "Открыть навигацию", en: "Open navigation" },
  "app.privateByDefault": { ru: "Приватно по умолчанию", en: "Private by default" },
  "app.themeDark": { ru: "Тёмная", en: "Dark" },
  "app.themeLight": { ru: "Светлая", en: "Light" },
  "app.toDark": { ru: "Переключить на тёмную тему", en: "Switch to dark mode" },
  "app.toLight": { ru: "Переключить на светлую тему", en: "Switch to light mode" },
  "app.switchLang": { ru: "Switch to English", en: "Переключить на русский" },
  "app.close": { ru: "Закрыть", en: "Close" },
  "app.cancel": { ru: "Отмена", en: "Cancel" },
  "app.save": { ru: "Сохранить", en: "Save" },
  "app.delete": { ru: "Удалить", en: "Delete" },
  "app.edit": { ru: "Изменить", en: "Edit" },
  "app.archive": { ru: "В архив", en: "Archive" },
  "app.restore": { ru: "Восстановить", en: "Restore" },
  "app.confirm": { ru: "Подтвердить", en: "Confirm" },
  "app.showAll": { ru: "Показать все", en: "Show all" },
  "app.showLess": { ru: "Свернуть", en: "Show less" },
  "app.quickAdd": { ru: "Быстро добавить", en: "Quick Add" },
  "app.add": { ru: "Добавить", en: "Add" },
  "app.all": { ru: "Все", en: "All" },
  "app.today": { ru: "Сегодня", en: "Today" },
  "app.week": { ru: "Неделя", en: "Week" },
  "app.month": { ru: "Месяц", en: "Month" },
  "app.year": { ru: "Год", en: "Year" },
  "app.notSet": { ru: "Не указано", en: "Not set" },
  "app.of": { ru: "из", en: "of" },
  "app.more": { ru: "Ещё", en: "More" },
  "app.openSection": { ru: "Открыть раздел", en: "Open section" },

  /* Navigation groups */
  "nav.overview": { ru: "Обзор", en: "Overview" },
  "nav.capital": { ru: "Капитал", en: "Capital" },
  "nav.life": { ru: "Жизнь", en: "Life" },
  "nav.readOnly": { ru: "только чтение", en: "read-only" },

  /* Views */
  "view.command": { ru: "Центр управления", en: "Command Center" },
  "view.inbox": { ru: "Входящие", en: "Inbox" },
  "view.tasks": { ru: "Задачи", en: "Tasks" },
  "view.projects": { ru: "Проекты", en: "Projects" },
  "view.capital": { ru: "Капитал", en: "Capital" },
  "view.debts": { ru: "Долги", en: "Debts" },
  "view.cashflow": { ru: "Денежный поток", en: "Cashflow" },
  "view.investments": { ru: "Инвестиции", en: "Investments" },
  "view.crypto": { ru: "Крипто", en: "Crypto" },
  "view.assets": { ru: "Имущество", en: "Assets" },
  "view.health": { ru: "Здоровье и спорт", en: "Health & sport" },
  "view.documents": { ru: "Документы", en: "Documents" },
  "view.people": { ru: "Люди", en: "People" },
  "view.decisions": { ru: "Решения", en: "Decisions" },
  "view.timeline": { ru: "Таймлайн", en: "Timeline" },
  "view.settings": { ru: "Настройки", en: "Settings" },

  /* The tab bar has about eight characters per label before it truncates. */
  "tab.command": { ru: "Главная", en: "Home" },
  "tab.tasks": { ru: "Задачи", en: "Tasks" },
  "tab.cashflow": { ru: "Деньги", en: "Money" },
  "tab.health": { ru: "Здоровье", en: "Health" },
  "tab.capital": { ru: "Капитал", en: "Capital" },

  /* Command Center */
  "cmd.morning": { ru: "Доброе утро", en: "Good morning" },
  "cmd.afternoon": { ru: "Добрый день", en: "Good afternoon" },
  "cmd.evening": { ru: "Добрый вечер", en: "Good evening" },
  "cmd.night": { ru: "Доброй ночи", en: "Good night" },
  "cmd.lede": { ru: "Ясный взгляд на то, что важно сейчас.", en: "A clear view of what matters now." },
  "cmd.today": { ru: "СЕГОДНЯ", en: "TODAY" },
  "cmd.keepMoving": { ru: "Держим день в движении", en: "Keep the day moving" },
  "cmd.noTasksToday": { ru: "На сегодня задач нет.", en: "Nothing scheduled for today." },
  "cmd.addFirstTask": { ru: "Добавить задачу", en: "Add a task" },
  "cmd.allTasks": { ru: "Все задачи", en: "View all tasks" },
  "cmd.attention": { ru: "ВНИМАНИЕ", en: "ATTENTION" },
  "cmd.attentionTitle": { ru: "На что стоит взглянуть", en: "Worth a look" },
  "cmd.attentionEmpty": { ru: "Ничего срочного. Это хорошая новость.", en: "Nothing urgent. That is good news." },
  "cmd.attentionRanked": { ru: "Отсортировано по срочности", en: "Ranked by urgency" },
  "cmd.capitalSnapshot": { ru: "СНИМОК КАПИТАЛА", en: "CAPITAL SNAPSHOT" },
  "cmd.netWorth": { ru: "Чистый капитал", en: "Net worth" },
  "cmd.noBalances": { ru: "Балансы ещё не заведены. Данные остаются у вас.", en: "No balances yet. Your data stays yours." },
  "cmd.fromConfirmed": { ru: "Только подтверждённые записи", en: "Confirmed records only" },
  "cmd.addFirstAccount": { ru: "Добавить первый счёт", en: "Add your first account" },
  "cmd.openCapital": { ru: "Открыть капитал", en: "Open capital" },
  "cmd.moving": { ru: "Что движется", en: "What is moving" },
  "cmd.projectsEmpty": { ru: "Активных проектов нет.", en: "No active projects." },
  "cmd.allProjects": { ru: "Все проекты", en: "All projects" },
  "cmd.recent": { ru: "НИТЬ СОБЫТИЙ", en: "ACTIVITY" },
  "cmd.recentTitle": { ru: "Последние изменения", en: "Recent changes" },
  "cmd.recentEmpty": { ru: "Изменения появятся здесь.", en: "Changes will appear here." },
  "cmd.liveSignal": { ru: "Живой сигнал", en: "Live signal" },
  "cmd.openAttention": { ru: "Открыть внимание", en: "Open attention" },
  "cmd.sport": { ru: "СПОРТ И ФОРМА", en: "SPORT & SHAPE" },
  "cmd.sportTitle": { ru: "Тело в этом месяце", en: "Your body this month" },
  "cmd.sportEmpty": { ru: "Запишите первую тренировку или вес.", en: "Log your first workout or weight." },
  "cmd.openHealth": { ru: "Открыть здоровье", en: "Open health" },

  /* Attention engine */
  "att.overdueTask": { ru: "Просроченная задача", en: "Overdue task" },
  "att.todayTask": { ru: "Задача на сегодня", en: "Task due today" },
  "att.paymentDue": { ru: "Скоро платёж", en: "Payment due" },
  "att.paymentOverdue": { ru: "Платёж просрочен", en: "Payment overdue" },
  "att.debtDue": { ru: "Срок возврата долга", en: "Debt due" },
  "att.documentExpiring": { ru: "Документ истекает", en: "Document expiring" },
  "att.reviewDue": { ru: "Пора пересмотреть", en: "Review due" },
  "att.reminder": { ru: "Напоминание", en: "Reminder" },
  "att.unconfirmed": { ru: "Записи ждут подтверждения", en: "Records await confirmation" },
  "att.unconfirmedHint": { ru: "Пока не подтвердите — не попадут в суммы", en: "Excluded from totals until confirmed" },
  "att.staleRates": { ru: "Курсы валют устарели", en: "Exchange rates are stale" },
  "att.noBackup": { ru: "Давно не было резервной копии", en: "No recent backup" },

  /* Records & lists */
  "rec.empty": { ru: "Здесь пока пусто.", en: "Nothing here yet." },
  "rec.addFirst": { ru: "Добавить первую запись", en: "Add the first record" },
  "rec.needsConfirmation": { ru: "не в расчёте", en: "not counted" },
  "rec.deleted": { ru: "Запись удалена", en: "Record deleted" },
  "rec.undo": { ru: "Вернуть", en: "Undo" },
  "rec.archived": { ru: "Запись в архиве", en: "Record archived" },
  "rec.saved": { ru: "Сохранено", en: "Saved" },
  "rec.updated": { ru: "Запись обновлена", en: "Record updated" },
  "rec.confirmed": { ru: "Запись подтверждена", en: "Record confirmed" },
  "rec.linkedTo": { ru: "Связано с", en: "Linked to" },
  "rec.source": { ru: "Источник", en: "Source" },
  "rec.confidence": { ru: "Уверенность", en: "Confidence" },
  "rec.reminder": { ru: "Напоминание", en: "Reminder" },
  "rec.showArchive": { ru: "Показать архив", en: "Show archive" },
  "rec.hideArchive": { ru: "Скрыть архив", en: "Hide archive" },
  "rec.trash": { ru: "Корзина", en: "Trash" },
  "rec.trashHint": { ru: "Удалённые записи хранятся 30 дней.", en: "Deleted records are kept for 30 days." },
  "rec.deleteForever": { ru: "Удалить навсегда", en: "Delete permanently" },
  "rec.confirmDelete": { ru: "Удалить запись? Её можно вернуть из корзины в течение 30 дней.", en: "Delete this record? You can restore it from Trash within 30 days." },
  "rec.confirmPurge": { ru: "Удалить навсегда? Это действие необратимо.", en: "Delete permanently? This cannot be undone." },

  /* Forms */
  "form.name": { ru: "Название", en: "Name" },
  "form.category": { ru: "Категория", en: "Category" },
  "form.counterparty": { ru: "Банк / контрагент", en: "Institution / counterparty" },
  "form.contact": { ru: "Контакт", en: "Contact" },
  "form.amount": { ru: "Сумма", en: "Amount" },
  "form.costBasis": { ru: "Вложено изначально", en: "Cost basis" },
  "form.currency": { ru: "Валюта", en: "Currency" },
  "form.date": { ru: "Дата", en: "Date" },
  "form.dueTime": { ru: "Время", en: "Time" },
  "form.dueDate": { ru: "Срок", en: "Due date" },
  "form.endDate": { ru: "Дата завершения", en: "End date" },
  "form.expiresAt": { ru: "Действует до", en: "Expires" },
  "form.status": { ru: "Статус", en: "Status" },
  "form.priority": { ru: "Приоритет", en: "Priority" },
  "form.terms": { ru: "Условия / день платежа", en: "Terms / payment day" },
  "form.rate": { ru: "Ставка, %", en: "Rate, %" },
  "form.owner": { ru: "Чьё это", en: "Owner" },
  "form.progress": { ru: "Готовность, %", en: "Progress, %" },
  "form.ownershipPercent": { ru: "Доля владения, %", en: "Ownership, %" },
  "form.details": { ru: "Контекст или заметка", en: "Context or note" },
  "form.reasoning": { ru: "Ход мысли", en: "Reasoning" },
  "form.source": { ru: "Источник", en: "Source" },
  "form.confidence": { ru: "Уверенность", en: "Confidence" },
  "form.reminderDate": { ru: "Напомнить", en: "Remind me" },
  "form.linked": { ru: "Связать с записью", en: "Link to a record" },
  "form.noLink": { ru: "Без связи", en: "No link" },
  "form.file": { ru: "Файл (сохраняются только имя и размер)", en: "File (name and size only)" },
  "form.recurrence": { ru: "Повторяется", en: "Repeats" },
  "form.frequency": { ru: "Как часто", en: "How often" },
  "form.nextDue": { ru: "Следующий платёж", en: "Next payment" },
  "form.coin": { ru: "Монета", en: "Coin" },
  "form.quantity": { ru: "Количество", en: "Quantity" },
  "form.walletAddress": { ru: "Публичный адрес", en: "Public address" },
  "form.duration": { ru: "Длительность, мин", en: "Duration, min" },
  "form.distance": { ru: "Дистанция, км", en: "Distance, km" },
  "form.intensity": { ru: "Интенсивность 1–10", en: "Intensity 1–10" },
  "form.feeling": { ru: "Самочувствие 1–5", en: "How it felt 1–5" },
  "form.value": { ru: "Значение", en: "Value" },
  "form.unit": { ru: "Единица", en: "Unit" },
  "form.refLow": { ru: "Норма от", en: "Reference low" },
  "form.refHigh": { ru: "Норма до", en: "Reference high" },
  "form.lab": { ru: "Лаборатория", en: "Laboratory" },
  "form.required": { ru: "Заполните это поле", en: "This field is required" },
  "form.optional": { ru: "необязательно", en: "optional" },
  "form.amountHint": { ru: "Можно писать «1 500», «1,5к» или «2м»", en: "You can type 1 500, 1.5k or 2m" },
  "form.moreFields": { ru: "Больше полей", en: "More fields" },
  "form.fewerFields": { ru: "Меньше полей", en: "Fewer fields" },
  "form.editTitle": { ru: "Изменить запись", en: "Edit record" },

  /* Money */
  "money.netWorth": { ru: "ЧИСТЫЙ КАПИТАЛ", en: "NET WORTH" },
  "money.liquid": { ru: "ЛИКВИДНЫЕ", en: "LIQUID" },
  "money.invested": { ru: "ИНВЕСТИЦИИ", en: "INVESTED" },
  "money.property": { ru: "ИМУЩЕСТВО", en: "PROPERTY" },
  "money.debt": { ru: "ДОЛГИ", en: "DEBT" },
  "money.owedToMe": { ru: "МНЕ ДОЛЖНЫ", en: "OWED TO ME" },
  "money.confidence": { ru: "УВЕРЕННОСТЬ", en: "CONFIDENCE" },
  "money.income": { ru: "ДОХОДЫ", en: "INCOME" },
  "money.expenses": { ru: "РАСХОДЫ", en: "EXPENSES" },
  "money.net": { ru: "ЧИСТЫЙ ПОТОК", en: "NET FLOW" },
  "money.period": { ru: "ПЕРИОД", en: "PERIOD" },
  "money.monthlyLoad": { ru: "В МЕСЯЦ", en: "MONTHLY LOAD" },
  "money.dueSoon": { ru: "СКОРО ПЛАТЁЖ", en: "DUE SOON" },
  "money.activeCount": { ru: "АКТИВНЫХ", en: "ACTIVE" },
  "money.baseCurrency": { ru: "Основная валюта", en: "Base currency" },
  "money.convertedAt": { ru: "пересчитано по курсу", en: "converted at" },
  "money.rateSource": { ru: "Источник курса", en: "Rate source" },
  "money.ratesUpdated": { ru: "Курсы обновлены", en: "Rates updated" },
  "money.ratesFailed": { ru: "Не удалось обновить курсы — показан последний известный", en: "Could not refresh rates — showing the last known set" },
  "money.refreshRates": { ru: "Обновить курсы", en: "Refresh rates" },
  "money.noRate": { ru: "нет курса", en: "no rate" },
  "money.originalCurrency": { ru: "в исходной валюте", en: "in original currency" },
  "money.excluded": { ru: "не в расчёте", en: "excluded" },
  "money.takeSnapshot": { ru: "Сохранить снимок", en: "Take snapshot" },
  "money.snapshotSaved": { ru: "Снимок капитала сохранён", en: "Capital snapshot saved" },
  "money.snapshotHistory": { ru: "История снимков", en: "Snapshot history" },
  "money.snapshotEmpty": { ru: "Снимков пока нет.", en: "No snapshots yet." },
  "money.confirmAll": { ru: "Подтвердить все", en: "Confirm all" },

  /* Health & sport */
  "health.thisMonth": { ru: "В ЭТОМ МЕСЯЦЕ", en: "THIS MONTH" },
  "health.workouts": { ru: "Тренировки", en: "Workouts" },
  "health.hours": { ru: "Часы нагрузки", en: "Active hours" },
  "health.distance": { ru: "Дистанция", en: "Distance" },
  "health.weight": { ru: "Вес", en: "Weight" },
  "health.weightTrend": { ru: "Динамика веса", en: "Weight trend" },
  "health.noData": { ru: "Нет данных", en: "No data" },
  "health.logWorkout": { ru: "Записать тренировку", en: "Log a workout" },
  "health.logMeasurement": { ru: "Записать показатель", en: "Log a measurement" },
  "health.contextNotDiagnosis": { ru: "Контекст, а не диагноз. Nik'Os не заменяет врача.", en: "Context, not diagnosis. Nik'Os does not replace a doctor." },
  "health.streak": { ru: "Подряд", en: "Streak" },
  "health.days": { ru: "дней", en: "days" },
  "health.lastWorkout": { ru: "Последняя тренировка", en: "Last workout" },
  "health.importCsv": { ru: "Импорт CSV", en: "Import CSV" },
  "health.addLab": { ru: "Добавить анализы", en: "Add lab results" },
  "health.pasteLab": { ru: "Вставить из PDF", en: "Paste from a PDF" },
  "health.pasteLabHint": { ru: "Откройте PDF из лаборатории, выделите таблицу с результатами, скопируйте и вставьте сюда. Текст никуда не отправляется — разбор идёт в вашем браузере.", en: "Open the lab PDF, select the results table, copy it and paste it here. The text is not sent anywhere — parsing happens in your browser." },
  "health.labParsed": { ru: "Распознано показателей", en: "Values recognised" },
  "health.labNothing": { ru: "Не удалось распознать ни одной строки. Проверьте, что скопирована таблица с результатами.", en: "No rows were recognised. Check that you copied the results table." },
  "health.outOfRange": { ru: "вне нормы", en: "out of range" },
  "health.aboveRange": { ru: "выше нормы", en: "above range" },
  "health.belowRange": { ru: "ниже нормы", en: "below range" },
  "health.inRange": { ru: "в норме", en: "in range" },
  "health.labs": { ru: "Анализы", en: "Lab results" },
  "health.labDate": { ru: "Дата сдачи", en: "Sample date" },
  "health.notDiagnosis": { ru: "Nik'Os сравнивает ваши цифры с нормами, указанными самой лабораторией. Это не диагноз и не замена врачу.", en: "Nik'Os compares your numbers with the reference ranges printed by the laboratory itself. This is not a diagnosis and not a substitute for a doctor." },

  /* Security */
  "sec.lockTitle": { ru: "Nik'Os заперт", en: "Nik'Os is locked" },
  "sec.enterPin": { ru: "Введите PIN", en: "Enter your PIN" },
  "sec.wrongPin": { ru: "Неверный PIN", en: "Wrong PIN" },
  "sec.unlock": { ru: "Открыть", en: "Unlock" },
  "sec.setPin": { ru: "Установить PIN", en: "Set a PIN" },
  "sec.setPinHint": { ru: "От 4 до 12 цифр. Данные в браузере будут зашифрованы этим PIN.", en: "4 to 12 digits. Your browser data will be encrypted with this PIN." },
  "sec.repeatPin": { ru: "Повторите PIN", en: "Repeat the PIN" },
  "sec.pinMismatch": { ru: "PIN не совпадают", en: "The PINs do not match" },
  "sec.pinTooShort": { ru: "Нужно минимум 4 цифры", en: "At least 4 digits" },
  "sec.pinEnabled": { ru: "PIN установлен, данные зашифрованы", en: "PIN set, data encrypted" },
  "sec.pinRemoved": { ru: "PIN снят, данные расшифрованы", en: "PIN removed, data decrypted" },
  "sec.backupFirst": { ru: "Сначала скачайте резервную копию. Забытый PIN восстановить нельзя.", en: "Download a backup first. A forgotten PIN cannot be recovered." },
  "sec.backupDownloaded": { ru: "Я скачал резервную копию", en: "I have downloaded the backup" },
  "sec.removePin": { ru: "Снять PIN", en: "Remove PIN" },
  "sec.lockNow": { ru: "Запереть сейчас", en: "Lock now" },
  "sec.autoLock": { ru: "Запирать после простоя", en: "Lock after idle" },
  "sec.seedBlocked": { ru: "Похоже на seed-фразу — Nik'Os не сохраняет такое", en: "This looks like a seed phrase — Nik'Os will not store it" },
  "sec.seedBlockedHint": { ru: "Nik'Os никогда не хранит seed-фразы, приватные ключи и пароли. Удалите эти слова, чтобы сохранить запись.", en: "Nik'Os never stores seed phrases, private keys or passwords. Remove those words to save the record." },
  "sec.storageFull": { ru: "В браузере кончилось место — запись НЕ сохранена", en: "Browser storage is full — the record was NOT saved" },
  "sec.storageFullHint": { ru: "Скачайте резервную копию и удалите старые импортированные строки.", en: "Download a backup and remove old imported rows." },

  /* Settings & sync */
  "set.cloudSync": { ru: "ОБЛАЧНАЯ СИНХРОНИЗАЦИЯ", en: "CLOUD SYNC" },
  "set.backup": { ru: "Резервные копии", en: "Backups" },
  "set.exportData": { ru: "Скачать резервную копию", en: "Download backup" },
  "set.importData": { ru: "Загрузить резервную копию", en: "Restore from backup" },
  "set.security": { ru: "Безопасность", en: "Security" },
  "set.demoData": { ru: "Демо-данные", en: "Demo data" },
  "set.loadDemo": { ru: "Загрузить пример", en: "Load sample data" },
  "set.clearDemo": { ru: "Очистить всё", en: "Clear everything" },
  "set.install": { ru: "Установить на устройство", en: "Install on this device" },
  "set.language": { ru: "Язык", en: "Language" },
  "set.theme": { ru: "Тема", en: "Theme" },
  "set.rates": { ru: "Курсы валют", en: "Exchange rates" },
  "set.autoRates": { ru: "Обновлять курсы автоматически", en: "Refresh rates automatically" },
  "set.autoRatesHint": { ru: "Запрашивает курс ЦБ РФ и цены криптовалют. Ваши записи никуда не отправляются.", en: "Fetches CBR rates and crypto prices. None of your records are sent anywhere." }
};

/* t("key") → string. Unknown keys return the key itself so a missing
   translation is visible in testing rather than rendering as blank. */
export function t(key, vars = null) {
  const entry = DICT[key];
  let text = entry ? entry[locale] ?? entry.ru : key;
  if (vars) for (const [name, value] of Object.entries(vars)) text = text.replaceAll(`{${name}}`, String(value));
  return text;
}

export const hasKey = (key) => Object.hasOwn(DICT, key);

/* Russian needs three plural forms; English needs two. Getting
   "3 пунктов требуют внимания" right is not optional in an RU-first product. */
const pluralRules = { ru: new Intl.PluralRules("ru-RU"), en: new Intl.PluralRules("en-US") };

export function plural(count, forms) {
  const rule = pluralRules[locale].select(Number(count));
  const set = forms[locale] || forms.ru;
  return set[rule] ?? set.other ?? set.many ?? "";
}

export const countOf = (count, forms) => `${new Intl.NumberFormat(localeTag()).format(count)} ${plural(count, forms)}`;

export const PLURALS = {
  record:   { ru: { one: "запись", few: "записи", many: "записей", other: "записи" },
              en: { one: "record", other: "records" } },
  task:     { ru: { one: "задача", few: "задачи", many: "задач", other: "задачи" },
              en: { one: "task", other: "tasks" } },
  item:     { ru: { one: "пункт", few: "пункта", many: "пунктов", other: "пункта" },
              en: { one: "item", other: "items" } },
  account:  { ru: { one: "счёт", few: "счёта", many: "счетов", other: "счёта" },
              en: { one: "account", other: "accounts" } },
  liability:{ ru: { one: "обязательство", few: "обязательства", many: "обязательств", other: "обязательства" },
              en: { one: "liability", other: "liabilities" } },
  workout:  { ru: { one: "тренировка", few: "тренировки", many: "тренировок", other: "тренировки" },
              en: { one: "workout", other: "workouts" } },
  day:      { ru: { one: "день", few: "дня", many: "дней", other: "дня" },
              en: { one: "day", other: "days" } },
  row:      { ru: { one: "строка", few: "строки", many: "строк", other: "строки" },
              en: { one: "row", other: "rows" } },
  proposal: { ru: { one: "предложение", few: "предложения", many: "предложений", other: "предложения" },
              en: { one: "proposal", other: "proposals" } }
};

/* "3 пункта требуют внимания" — verb agreement matters too. */
export function needAttention(count) {
  if (locale === "en") return `${count} ${plural(count, PLURALS.item)} need${count === 1 ? "s" : ""} your attention`;
  const verb = pluralRules.ru.select(count) === "one" ? "требует" : "требуют";
  return `${countOf(count, PLURALS.item)} ${verb} внимания`;
}

/* Schema label helpers — one source of truth for every enum label. */
const label = (map, key) => (map[key] ? map[key][locale] ?? map[key].ru : key || "—");
export const statusLabel = (key) => label(STATUS, key);
export const statusTone = (key) => STATUS[key]?.tone || "muted";
export const priorityLabel = (key) => label(PRIORITY, key);
export const confidenceLabel = (key) => label(CONFIDENCE, key);
export const ownerLabel = (key) => label(OWNER, key);
export const frequencyLabel = (key) => label(FREQUENCY, key);
export const typeLabel = (key) => (TYPES[key] ? TYPES[key].title[locale] ?? TYPES[key].title.ru : key);
export const typePlural = (key) => (TYPES[key] ? TYPES[key].plural[locale] ?? TYPES[key].plural.ru : key);

export function categoryLabel(type, categoryKey) {
  const found = (TYPES[type]?.categories || []).find((item) => item.key === categoryKey);
  return found ? found[locale] ?? found.ru : categoryKey || "—";
}

/* Dates: always rendered through Intl, never hand-built. */
export function formatDate(value, style = "medium") {
  const date = toDate(value);
  if (!date) return t("app.notSet");
  const options = style === "long" ? { day: "numeric", month: "long", year: "numeric" }
    : style === "short" ? { day: "numeric", month: "short" }
    : style === "weekday" ? { weekday: "long", day: "numeric", month: "long", year: "numeric" }
    : { day: "numeric", month: "short", year: "numeric" };
  return new Intl.DateTimeFormat(localeTag(), options).format(date);
}

export function formatDateTime(value) {
  const date = toDate(value);
  if (!date) return t("app.notSet");
  return new Intl.DateTimeFormat(localeTag(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}

export function relativeDays(value) {
  const date = toDate(value);
  if (!date) return "";
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round((startOfDay(date) - startOfDay(new Date())) / 86400000);
  if (days === 0) return t("app.today");
  if (Math.abs(days) > 30) return formatDate(value, "short");
  return new Intl.RelativeTimeFormat(localeTag(), { numeric: "auto" }).format(days, "day");
}

export function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  // Date-only strings are read as local noon so a timezone shift can never
  // move a record to the previous or next day.
  const text = String(value);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(text) ? new Date(`${text}T12:00:00`) : new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

export const formatNumber = (value, digits = 0) =>
  Number.isFinite(Number(value))
    ? new Intl.NumberFormat(localeTag(), { maximumFractionDigits: digits }).format(Number(value))
    : "—";
