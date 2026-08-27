/* Which door to knock on.
 *
 * This file answers one narrow, administrative question: which specialty
 * normally looks after a given test. That is public, stable information about
 * how medicine is organised — the same thing a clinic receptionist knows — and
 * it is not a reading of anyone's results.
 *
 * What this file deliberately does NOT contain: what a value means, what might
 * cause it, or what to do about it. A number outside a range has many possible
 * explanations, most of them requiring context Nik'Os does not have — other
 * results, medication, symptoms, history, an examination. Guessing between
 * them is the job of the person you are being pointed towards.
 *
 * Descriptions of what each test measures come from the laboratory itself and
 * are stored with the records, never written here. */

const SPECIALTIES = {
  therapist:     { ru: "Терапевт", en: "General practitioner" },
  nephrologist:  { ru: "Нефролог", en: "Nephrologist" },
  hepatologist:  { ru: "Гастроэнтеролог или гепатолог", en: "Gastroenterologist or hepatologist" },
  endocrinologist: { ru: "Эндокринолог", en: "Endocrinologist" },
  cardiologist:  { ru: "Кардиолог", en: "Cardiologist" },
  haematologist: { ru: "Гематолог", en: "Haematologist" },
  urologist:     { ru: "Уролог", en: "Urologist" },
  immunologist:  { ru: "Аллерголог-иммунолог", en: "Allergist-immunologist" },
  rheumatologist:{ ru: "Ревматолог", en: "Rheumatologist" },
  oncologist:    { ru: "Онколог или терапевт", en: "Oncologist or GP" },
  gastro:        { ru: "Гастроэнтеролог", en: "Gastroenterologist" }
};

/* Analyte name → the system it belongs to and who usually reads it.
   Order matters: the first match wins, so specific patterns come first. */
const ROUTES = [
  { re: /(ферритин|железо|трансферрин|железосвязыв|насыщения трансферрина|гемосидерин)/i,
    system: { ru: "Обмен железа", en: "Iron metabolism" }, to: "haematologist" },

  { re: /(креатинин|мочевина|клубочков|скф|цистатин|альбумин.*моч|микроальбумин)/i,
    system: { ru: "Почки", en: "Kidneys" }, to: "nephrologist" },

  { re: /(алт|аст|аланинамино|аспартатамино|ггт|гамма-глутамил|билирубин|щелочная фосфатаза|альбумин$|общий белок)/i,
    system: { ru: "Печень", en: "Liver" }, to: "hepatologist" },

  { re: /(ттг|тиреотроп|т3|т4|трийодтиронин|тироксин|тиреоглобулин|антитела к тпо)/i,
    system: { ru: "Щитовидная железа", en: "Thyroid" }, to: "endocrinologist" },

  { re: /(глюкоза|гликированн|инсулин|homa|caro|с-пептид|лептин)/i,
    system: { ru: "Углеводный обмен", en: "Glucose metabolism" }, to: "endocrinologist" },

  { re: /(тестостерон|кортизол|пролактин|эстрадиол|прогестерон|лютеинизирующ|фолликулостимул|дгэа|гспг|андроген|паратгормон|соматотроп)/i,
    system: { ru: "Гормоны", en: "Hormones" }, to: "endocrinologist" },

  { re: /(холестерин|лпнп|лпвп|лпонп|триглицерид|атероген|липопротеин|аполипопротеин)/i,
    system: { ru: "Липиды", en: "Lipids" }, to: "cardiologist" },

  { re: /(с-реактивн|гомоцистеин|тропонин|натрийуретич|кардиориск)/i,
    system: { ru: "Сердечно-сосудистые риски", en: "Cardiovascular markers" }, to: "cardiologist" },

  { re: /(гемоглобин|эритроцит|гематокрит|mcv|mch|mchc|ретикулоцит|тромбоцит|лейкоцит|нейтрофил|лимфоцит|моноцит|эозинофил|базофил|соэ|ширина распред|mpv|pdw|pct)/i,
    system: { ru: "Кровь", en: "Blood count" }, to: "haematologist" },

  { re: /(фибриноген|ачтв|протромбин|мно|тромбиновое|д-димер|антитромбин)/i,
    system: { ru: "Свёртывание", en: "Coagulation" }, to: "haematologist" },

  { re: /(пса|простат-специфич)/i,
    system: { ru: "Простата", en: "Prostate" }, to: "urologist" },

  { re: /(в моче|моч[аи]\b|уробилиноген|кетон|нитрит|цилиндр|эпителий|относительная плотность)/i,
    system: { ru: "Моча", en: "Urine" }, to: "urologist" },

  { re: /(мочевая кислота|ураты)/i,
    system: { ru: "Пуриновый обмен", en: "Purine metabolism" }, to: "rheumatologist" },

  /* An allergy panel lists every allergen as its own line — RIDA3, f-codes and
     the like — and they all belong to one appointment. */
  { re: /(rida|f\d{1,3}|аллерг|клейковина|глютен|трансглутаминаз|ige|иммуноглобулин e)/i,
    system: { ru: "Аллергия", en: "Allergy" }, to: "immunologist" },

  { re: /(иммуноглобулин|комплемент|циркулирующие иммунные)/i,
    system: { ru: "Иммунитет", en: "Immunity" }, to: "immunologist" },

  { re: /(афп|альфа-фетопротеин|са\s?\d|антиген ca|рэа|кальцитонин|онкомаркер|хгч|nse|scc)/i,
    system: { ru: "Онкомаркеры", en: "Tumour markers" }, to: "oncologist" },

  { re: /(амилаза|липаза|эластаза|панкреат|гастрин|пепсиноген|копрограмма|кальпротектин)/i,
    system: { ru: "Поджелудочная и ЖКТ", en: "Pancreas and gut" }, to: "gastro" },

  { re: /(гельминт|простейшие|лямбли|описторх|аскарид|токсокар)/i,
    system: { ru: "Паразиты", en: "Parasites" }, to: "gastro" },

  { re: /(витамин|фолиев|цинк|магний|кальций|калий|натрий|хлорид|фосфор|селен|25-oh)/i,
    system: { ru: "Витамины и минералы", en: "Vitamins and minerals" }, to: "therapist" },

  { re: /(гепатит|вич|сифилис|трепонем|hcv|hbs|h\.?\s?pylori|хеликобактер|уреазный)/i,
    system: { ru: "Инфекции", en: "Infections" }, to: "therapist" }
];

export function routeFor(name, locale = "ru") {
  const route = ROUTES.find((entry) => entry.re.test(String(name)));
  if (!route) return null;
  const specialty = SPECIALTIES[route.to];
  return {
    system: locale === "ru" ? route.system.ru : route.system.en,
    specialist: locale === "ru" ? specialty.ru : specialty.en,
    key: route.to
  };
}

/* Group a set of out-of-range analytes by the specialist who reads them, so
   one appointment can cover everything that belongs together. */
export function groupBySpecialist(groups, locale = "ru") {
  const buckets = new Map();

  for (const group of groups) {
    const route = routeFor(group.name, locale);
    const key = route?.key ?? "other";
    if (!buckets.has(key)) {
      buckets.set(key, {
        key,
        specialist: route?.specialist ?? (locale === "ru" ? "Терапевт" : "General practitioner"),
        systems: new Set(),
        analytes: []
      });
    }
    const bucket = buckets.get(key);
    if (route?.system) bucket.systems.add(route.system);
    bucket.analytes.push(group);
  }

  return [...buckets.values()]
    .map((bucket) => ({ ...bucket, systems: [...bucket.systems] }))
    .sort((a, b) => b.analytes.length - a.analytes.length);
}

export const ROUTING_NOTE = {
  ru: "Это подсказка, к какому специалисту обычно относится показатель, а не мнение о ваших результатах. Что означают конкретные цифры — вопрос к врачу, у которого есть остальной контекст: другие анализы, лекарства, самочувствие, осмотр.",
  en: "This points at the specialty that usually reads a given test. It is not an opinion about your results — what your numbers mean is a question for a doctor who has the rest of the context: other results, medication, symptoms, an examination."
};
