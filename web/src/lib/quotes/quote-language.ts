/**
 * Quotation languages. A customer document can carry its fixed words (headings, row labels, the hint, the closing sentence) in English
 * AND the customer's own language, side by side: "Routing · Itinerario". English always comes first.
 * What is NOT translated, on purpose: names the desk typed (carrier names, surcharge names), the terms and conditions (they stay English,
 * and the document says so), and any money figure. Uses no AI credit: it is a fixed word list.
 * The Arabic, Spanish, French, German, Portuguese and Italian wording was prepared without a native-speaker review: have someone who
 * speaks the language read one sample before it is sent to a customer.
 */

export type DocLang = "en" | "ar" | "es" | "fr" | "de" | "pt" | "it";

export const DOC_LANGS: Array<{ id: DocLang; label: string; native: string; rtl?: boolean }> = [
  { id: "en", label: "English only", native: "English" },
  { id: "ar", label: "English + Arabic", native: "العربية", rtl: true },
  { id: "es", label: "English + Spanish", native: "Español" },
  { id: "fr", label: "English + French", native: "Français" },
  { id: "de", label: "English + German", native: "Deutsch" },
  { id: "pt", label: "English + Portuguese", native: "Português" },
  { id: "it", label: "English + Italian", native: "Italiano" },
];

export const isDocLang = (v: unknown): v is DocLang => typeof v === "string" && DOC_LANGS.some((l) => l.id === v);

type Table = Record<Exclude<DocLang, "en">, string>;
const T = (ar: string, es: string, fr: string, de: string, pt: string, it: string): Table => ({ ar, es, fr, de, pt, it });

/** English phrase -> the same phrase in each language. Looked up by exact text, so a name the desk typed is never touched. */
const WORDS: Record<string, Table> = {
  "Official Freight Quotation": T("عرض سعر الشحن الرسمي", "Cotización oficial de flete", "Cotation officielle de fret", "Offizielles Frachtangebot", "Cotação oficial de frete", "Quotazione ufficiale di trasporto"),
  "Prepared by": T("أعدّه", "Preparado por", "Préparé par", "Erstellt von", "Preparado por", "Preparato da"),
  Customer: T("العميل", "Cliente", "Client", "Kunde", "Cliente", "Cliente"),
  Attention: T("عناية", "A la atención de", "À l'attention de", "Zu Händen", "Atenção", "All'attenzione di"),
  Reference: T("المرجع", "Referencia", "Référence", "Referenz", "Referência", "Riferimento"),
  Status: T("الحالة", "Estado", "Statut", "Status", "Situação", "Stato"),
  Quoted: T("تم التسعير", "Cotizado", "Coté", "Angeboten", "Cotado", "Quotato"),
  Route: T("المسار", "Ruta", "Itinéraire", "Route", "Rota", "Percorso"),
  Creator: T("المُنشئ", "Creado por", "Créé par", "Bearbeiter", "Criado por", "Creato da"),
  Date: T("التاريخ", "Fecha", "Date", "Datum", "Data", "Data"),
  Origin: T("المنشأ", "Origen", "Origine", "Abgangsort", "Origem", "Origine"),
  Destination: T("الوجهة", "Destino", "Destination", "Bestimmungsort", "Destino", "Destinazione"),
  Lanes: T("المسارات", "Rutas", "Trajets", "Relationen", "Rotas", "Tratte"),
  "All lanes total": T("إجمالي جميع المسارات", "Total de todas las rutas", "Total de tous les trajets", "Summe aller Relationen", "Total de todas as rotas", "Totale di tutte le tratte"),
  Routing: T("خط السير", "Itinerario", "Acheminement", "Routing", "Roteiro", "Instradamento"),
  "Transit time": T("مدة العبور", "Tiempo de tránsito", "Délai de transit", "Laufzeit", "Tempo de trânsito", "Tempo di transito"),
  Validity: T("الصلاحية", "Validez", "Validité", "Gültigkeit", "Validade", "Validità"),
  Notes: T("ملاحظات", "Notas", "Remarques", "Hinweise", "Observações", "Note"),
  "Sell total": T("السعر الإجمالي", "Precio total", "Prix total", "Gesamtpreis", "Preço total", "Prezzo totale"),
  "Quoted total": T("الإجمالي المعروض", "Total cotizado", "Total proposé", "Angebotssumme", "Total cotado", "Totale quotato"),
  "quoted offer": T("العرض المقترح", "oferta cotizada", "offre proposée", "empfohlenes Angebot", "oferta cotada", "offerta proposta"),
  alternative: T("بديل", "alternativa", "alternative", "Alternative", "alternativa", "alternativa"),
  lowest: T("الأقل سعراً", "más bajo", "le moins cher", "günstigste", "mais baixo", "più basso"),
  highest: T("الأعلى سعراً", "más alto", "le plus cher", "teuerste", "mais alto", "più alto"),
  "Terms & conditions": T("الشروط والأحكام", "Términos y condiciones", "Conditions générales", "Allgemeine Geschäftsbedingungen", "Termos e condições", "Termini e condizioni"),
  "(in English)": T("(بالإنجليزية)", "(en inglés)", "(en anglais)", "(auf Englisch)", "(em inglês)", "(in inglese)"),
  "No carrier options on this quotation.": T("لا توجد خيارات ناقل في عرض السعر هذا.", "No hay opciones de transportista en esta cotización.", "Aucune option de transporteur dans cette cotation.", "Dieses Angebot enthält keine Carrier-Optionen.", "Não há opções de transportadora nesta cotação.", "Nessuna opzione di vettore in questa quotazione."),
  "Airline options": T("خيارات شركات الطيران", "Opciones de aerolíneas", "Options de compagnies aériennes", "Optionen Fluggesellschaften", "Opções de companhias aéreas", "Opzioni compagnie aeree"),
  "Liner / coloader options": T("خيارات الخطوط الملاحية / المجمّعين", "Opciones de naviera / coloader", "Options armateur / groupeur", "Optionen Reederei / Sammelladung", "Opções de armador / coloader", "Opzioni armatore / groupage"),
  "Courier options": T("خيارات شركات البريد السريع", "Opciones de mensajería", "Options de coursier", "Kurier-Optionen", "Opções de courier", "Opzioni corriere"),
  "Trucker options": T("خيارات شركات النقل بالشاحنات", "Opciones de transporte terrestre", "Options de transporteur routier", "Optionen Straßentransport", "Opções de transporte rodoviário", "Opzioni autotrasporto"),
  "Storage option": T("خيار التخزين", "Opción de almacenaje", "Option de stockage", "Lageroption", "Opção de armazenagem", "Opzione di stoccaggio"),
  "Vendor options": T("خيارات المورّدين", "Opciones de proveedores", "Options de prestataires", "Anbieter-Optionen", "Opções de fornecedores", "Opzioni fornitore"),
  Freight: T("الشحن", "Flete", "Fret", "Fracht", "Frete", "Nolo"),
  Detention: T("رسوم احتجاز", "Detention (demora)", "Frais de détention", "Standgeld", "Detention (sobrestadia)", "Detention (controstallie)"),
  Tolls: T("رسوم الطرق", "Peajes", "Péages", "Maut", "Pedágios", "Pedaggi"),
  Storage: T("التخزين", "Almacenaje", "Stockage", "Lagerung", "Armazenagem", "Stoccaggio"),
  Handling: T("المناولة", "Manejo", "Manutention", "Handling", "Manuseio", "Movimentazione"),
  "Base freight": T("أجرة الشحن الأساسية", "Flete base", "Fret de base", "Grundfracht", "Frete base", "Nolo base"),
  "Base freight (minimum charge)": T("أجرة الشحن الأساسية (الحد الأدنى)", "Flete base (cargo mínimo)", "Fret de base (minimum de perception)", "Grundfracht (Mindestbetrag)", "Frete base (cobrança mínima)", "Nolo base (minimo)"),
  "Origin fees": T("رسوم بلد المنشأ", "Gastos en origen", "Frais à l'origine", "Kosten am Abgangsort", "Taxas na origem", "Spese all'origine"),
  "Local Origin Charges": T("رسوم المنشأ المحلية", "Cargos locales en origen", "Frais locaux à l'origine", "Lokale Kosten am Abgangsort", "Taxas locais na origem", "Spese locali all'origine"),
  "Destination fees": T("رسوم الوجهة", "Gastos en destino", "Frais à destination", "Kosten am Bestimmungsort", "Taxas no destino", "Spese a destinazione"),
  "Destination Clearance Charges": T("رسوم التخليص في الوجهة", "Gastos de despacho en destino", "Frais de dédouanement à destination", "Verzollungskosten am Bestimmungsort", "Taxas de desembaraço no destino", "Spese di sdoganamento a destinazione"),
  "Option total": T("إجمالي الخيار", "Total de la opción", "Total de l'option", "Summe der Option", "Total da opção", "Totale opzione"),
  "Customs/branch holiday advisory": T("تنبيه بشأن العطل الجمركية / عطل الفرع", "Aviso de festivos de aduana / sucursal", "Avis sur les jours fériés douaniers / de la succursale", "Hinweis zu Zoll- und Filialfeiertagen", "Aviso de feriados alfandegários / da filial", "Avviso sulle festività doganali / della filiale"),
  "Quoted offer total (client may choose another option above)": T("إجمالي العرض المقترح (للعميل اختيار خيار آخر من الخيارات أعلاه)", "Total de la oferta cotizada (el cliente puede elegir otra opción de las anteriores)", "Total de l'offre proposée (le client peut choisir une autre option ci-dessus)", "Summe des empfohlenen Angebots (andere Option oben wählbar)", "Total da oferta cotada (o cliente pode escolher outra opção acima)", "Totale dell'offerta proposta (il cliente può scegliere un'altra opzione sopra)"),
  "Quoted offer total per lane (client may choose another option per lane above)": T("إجمالي العرض المقترح لكل مسار (للعميل اختيار خيار آخر لكل مسار أعلاه)", "Total de la oferta cotizada por ruta (el cliente puede elegir otra opción por ruta)", "Total de l'offre proposée par trajet (le client peut choisir une autre option par trajet)", "Summe des empfohlenen Angebots je Relation (andere Option je Relation wählbar)", "Total da oferta cotada por rota (o cliente pode escolher outra opção por rota)", "Totale dell'offerta proposta per tratta (il cliente può scegliere un'altra opzione per tratta)"),
  "Options are listed from the lowest price to the highest. Lowest: the cheapest option. Highest: the most expensive option. Quoted offer: the option we recommend.": T(
    "الخيارات مرتبة من الأقل سعراً إلى الأعلى. «الأقل سعراً»: الخيار الأرخص. «الأعلى سعراً»: الخيار الأغلى. «العرض المقترح»: الخيار الذي نوصي به.",
    "Las opciones se ordenan del precio más bajo al más alto. «Más bajo»: la opción más económica. «Más alto»: la opción más cara. «Oferta cotizada»: la opción que le recomendamos.",
    "Les options sont classées du prix le plus bas au plus élevé. « Le moins cher » : l'option la plus économique. « Le plus cher » : l'option la plus coûteuse. « Offre proposée » : l'option que nous vous recommandons.",
    "Die Optionen sind vom niedrigsten zum höchsten Preis sortiert. „Günstigste“: die preiswerteste Option. „Teuerste“: die teuerste Option. „Empfohlenes Angebot“: die Option, die wir Ihnen empfehlen.",
    "As opções estão ordenadas do preço mais baixo ao mais alto. «Mais baixo»: a opção mais econômica. «Mais alto»: a opção mais cara. «Oferta cotada»: a opção que recomendamos.",
    "Le opzioni sono ordinate dal prezzo più basso al più alto. «Più basso»: l'opzione più economica. «Più alto»: l'opzione più costosa. «Offerta proposta»: l'opzione che consigliamo.",
  ),
  "The attached PDF matches this quotation, including the charge breakup.": T("ملف PDF المرفق مطابق لعرض السعر هذا، ويتضمن تفصيل الرسوم.", "El PDF adjunto coincide con esta cotización e incluye el desglose de cargos.", "Le PDF joint correspond à cette cotation et détaille les frais.", "Das beigefügte PDF entspricht diesem Angebot und enthält die Aufschlüsselung der Kosten.", "O PDF em anexo corresponde a esta cotação e inclui o detalhamento das taxas.", "Il PDF allegato corrisponde a questa quotazione e include il dettaglio delle spese."),
  "The attached PDF matches this quotation. It lists every option from lowest to highest price, with the full charge breakup for each one.": T("ملف PDF المرفق مطابق لعرض السعر هذا، ويعرض جميع الخيارات من الأقل سعراً إلى الأعلى مع تفصيل كامل للرسوم لكل خيار.", "El PDF adjunto coincide con esta cotización. Enumera todas las opciones del precio más bajo al más alto, con el desglose completo de cargos de cada una.", "Le PDF joint correspond à cette cotation. Il présente toutes les options, du prix le plus bas au plus élevé, avec le détail complet des frais de chacune.", "Das beigefügte PDF entspricht diesem Angebot. Es listet alle Optionen vom niedrigsten zum höchsten Preis mit der vollständigen Kostenaufschlüsselung je Option.", "O PDF em anexo corresponde a esta cotação. Lista todas as opções do preço mais baixo ao mais alto, com o detalhamento completo das taxas de cada uma.", "Il PDF allegato corrisponde a questa quotazione. Elenca tutte le opzioni dal prezzo più basso al più alto, con il dettaglio completo delle spese di ciascuna."),
};

/** The words in one language, or null for English or a phrase that has no translation (it then stays English). */
export function translate(lang: DocLang, english: string): string | null {
  if (lang === "en") return null;
  return WORDS[english]?.[lang] ?? null;
}

/** HTML: "Routing · <local>", local part marked with its language and, for Arabic, right-to-left. Plain English when there is nothing to add. */
export function bi(lang: DocLang, english: string, esc: (s: string) => string): string {
  const local = translate(lang, english);
  if (!local) return esc(english);
  const rtl = DOC_LANGS.find((l) => l.id === lang)?.rtl;
  return `${esc(english)} · <span lang="${lang}"${rtl ? ' dir="rtl"' : ""}>${esc(local)}</span>`;
}

/** Plain text (email body, chat): "Routing · Itinerario". */
export function biPlain(lang: DocLang, english: string): string {
  const local = translate(lang, english);
  return local ? `${english} · ${local}` : english;
}

// What language does a customer's country speak? Only clear cases: a shared language across a country is not guessed (Canada, Belgium,
// Switzerland, India and the like stay English unless the desk picks one). The sender's address ending is the evidence.
const COUNTRY_LANG: Record<string, DocLang> = {
  // Arabic
  ae: "ar", sa: "ar", qa: "ar", kw: "ar", om: "ar", bh: "ar", jo: "ar", eg: "ar", lb: "ar", iq: "ar", ma: "ar", dz: "ar", tn: "ar",
  // Spanish
  es: "es", mx: "es", ar: "es", co: "es", cl: "es", pe: "es", ec: "es", uy: "es", py: "es", bo: "es", ve: "es", cr: "es", pa: "es", gt: "es", do: "es",
  // French
  fr: "fr",
  // German
  de: "de", at: "de",
  // Portuguese
  pt: "pt", br: "pt", ao: "pt", mz: "pt",
  // Italian
  it: "it",
};

/** The language to suggest for a customer's email address, or "en" when the country is not one with a clear language. */
export function languageForEmail(email: string | undefined | null): DocLang {
  const domain = String(email || "").split("@")[1]?.toLowerCase().trim() ?? "";
  const tld = domain.split(".").pop() ?? "";
  return COUNTRY_LANG[tld] ?? "en";
}

/** The language set on a quote (chosen in the preview), else the one the customer's address suggests, else English. */
export function quoteDocLang(q: { details?: Record<string, unknown> | null; inboxRef?: { fromEmail?: string } | null }): DocLang {
  const chosen = q.details?.docLanguage;
  if (isDocLang(chosen)) return chosen;
  return languageForEmail(q.inboxRef?.fromEmail);
}
