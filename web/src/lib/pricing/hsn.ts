/** HSN chapters + key headings — ported from legacy Atlas autocomplete. */
export type HsnItem = { code: string; name: string; label: string };

const CHAPTERS: Array<{ code: string; name: string }> = [
  {
    "code": "01",
    "name": "Chapter 01 | Live Animals"
  },
  {
    "code": "02",
    "name": "Chapter 02 | Meat and edible meat offal"
  },
  {
    "code": "03",
    "name": "Chapter 03 | Fish & crustaceans, molluscs & other aquatic invertebrates"
  },
  {
    "code": "04",
    "name": "Chapter 04 | Dairy produce; birds' eggs; natural honey; edible products of animal origin"
  },
  {
    "code": "05",
    "name": "Chapter 05 | Products of animal origin, not elsewhere specified or included"
  },
  {
    "code": "06",
    "name": "Chapter 06 | Live trees & other plants; bulbs, roots; cut flowers & ornamental foliage"
  },
  {
    "code": "07",
    "name": "Chapter 07 | Edible vegetables and certain roots and tubers"
  },
  {
    "code": "08",
    "name": "Chapter 08 | Edible fruit and nuts; peel of citrus fruit or melons"
  },
  {
    "code": "09",
    "name": "Chapter 09 | Coffee, tea, maté and spices"
  },
  {
    "code": "10",
    "name": "Chapter 10 | Cereals"
  },
  {
    "code": "11",
    "name": "Chapter 11 | Products of the milling industry; malt; starches; inulin; wheat gluten"
  },
  {
    "code": "12",
    "name": "Chapter 12 | Oil seeds & oleaginous fruits; miscellaneous grains, seeds & fruit; industrial/medicinal plants; straw"
  },
  {
    "code": "13",
    "name": "Chapter 13 | Lac; gums, resins and other vegetable saps and extracts"
  },
  {
    "code": "14",
    "name": "Chapter 14 | Vegetable plaiting materials; vegetable products not elsewhere specified or included"
  },
  {
    "code": "15",
    "name": "Chapter 15 | Animal or vegetable fats and oils and their cleavage products; prepared edible fats"
  },
  {
    "code": "16",
    "name": "Chapter 16 | Preparations of meat, fish, crustaceans, molluscs or other aquatic invertebrates"
  },
  {
    "code": "17",
    "name": "Chapter 17 | Sugars and sugar confectionery"
  },
  {
    "code": "18",
    "name": "Chapter 18 | Cocoa and cocoa preparations"
  },
  {
    "code": "19",
    "name": "Chapter 19 | Preparations of cereals, flour, starch or milk; pastrycooks' products"
  },
  {
    "code": "20",
    "name": "Chapter 20 | Preparations of vegetables, fruit, nuts or other parts of plants"
  },
  {
    "code": "21",
    "name": "Chapter 21 | Miscellaneous edible preparations"
  },
  {
    "code": "22",
    "name": "Chapter 22 | Beverages, spirits and vinegar"
  },
  {
    "code": "23",
    "name": "Chapter 23 | Residues & waste from the food industries; prepared animal fodder"
  },
  {
    "code": "24",
    "name": "Chapter 24 | Tobacco and manufactured tobacco substitutes"
  },
  {
    "code": "25",
    "name": "Chapter 25 | Salt; sulphur; earths & stone; plastering materials, lime and cement"
  },
  {
    "code": "26",
    "name": "Chapter 26 | Ores, slag and ash"
  },
  {
    "code": "27",
    "name": "Chapter 27 | Mineral fuels, mineral oils & products of their distillation; bituminous substances"
  },
  {
    "code": "28",
    "name": "Chapter 28 | Inorganic chemicals; organic/inorganic compounds of precious metals, isotopes"
  },
  {
    "code": "29",
    "name": "Chapter 29 | Organic chemicals"
  },
  {
    "code": "30",
    "name": "Chapter 30 | Pharmaceutical products"
  },
  {
    "code": "31",
    "name": "Chapter 31 | Fertilizers"
  },
  {
    "code": "32",
    "name": "Chapter 32 | Tanning/dyeing extracts; tannins & derivatives; dyes, pigments, paints, varnishes, putty, inks"
  },
  {
    "code": "33",
    "name": "Chapter 33 | Essential oils & resinoids; perfumery, cosmetic or toilet preparations"
  },
  {
    "code": "34",
    "name": "Chapter 34 | Soap, organic surface-active agents, washing/lubricating prep, waxes, polishing prep, candles"
  },
  {
    "code": "35",
    "name": "Chapter 35 | Albuminoidal substances; modified starches; glues; enzymes"
  },
  {
    "code": "36",
    "name": "Chapter 36 | Explosives; pyrotechnic products; matches; pyrophoric alloys; certain combustible preparations"
  },
  {
    "code": "37",
    "name": "Chapter 37 | Photographic or cinematographic goods"
  },
  {
    "code": "38",
    "name": "Chapter 38 | Miscellaneous chemical products"
  },
  {
    "code": "39",
    "name": "Chapter 39 | Plastics and articles thereof"
  },
  {
    "code": "40",
    "name": "Chapter 40 | Rubber and articles thereof"
  },
  {
    "code": "41",
    "name": "Chapter 41 | Raw hides and skins (other than furskins) and leather"
  },
  {
    "code": "42",
    "name": "Chapter 42 | Articles of leather; saddlery & harness; travel goods, handbags; articles of animal gut"
  },
  {
    "code": "43",
    "name": "Chapter 43 | Furskins and artificial fur; manufactures thereof"
  },
  {
    "code": "44",
    "name": "Chapter 44 | Wood and articles of wood; wood charcoal"
  },
  {
    "code": "45",
    "name": "Chapter 45 | Cork and articles of cork"
  },
  {
    "code": "46",
    "name": "Chapter 46 | Manufactures of straw, esparto or other plaiting materials; basketware & wickerwork"
  },
  {
    "code": "47",
    "name": "Chapter 47 | Pulp of wood/other fibrous cellulosic material; recovered paper/paperboard"
  },
  {
    "code": "48",
    "name": "Chapter 48 | Paper & paperboard; articles of paper pulp, paper or paperboard"
  },
  {
    "code": "49",
    "name": "Chapter 49 | Printed books, newspapers, pictures & other products of printing industry; manuscripts"
  },
  {
    "code": "50",
    "name": "Chapter 50 | Silk"
  },
  {
    "code": "51",
    "name": "Chapter 51 | Wool, fine/coarse animal hair; horsehair yarn & woven fabric"
  },
  {
    "code": "52",
    "name": "Chapter 52 | Cotton"
  },
  {
    "code": "53",
    "name": "Chapter 53 | Other vegetable textile fibres; paper yarn and woven fabrics of paper yarn"
  },
  {
    "code": "54",
    "name": "Chapter 54 | Man-made filaments; strip and the like of man-made textile materials"
  },
  {
    "code": "55",
    "name": "Chapter 55 | Man-made staple fibres"
  },
  {
    "code": "56",
    "name": "Chapter 56 | Wadding, felt & nonwovens; special yarns; twine, cordage, ropes & cables"
  },
  {
    "code": "57",
    "name": "Chapter 57 | Carpets and other textile floor coverings"
  },
  {
    "code": "58",
    "name": "Chapter 58 | Special woven fabrics; tufted textile fabrics; lace; tapestries; trimmings; embroidery"
  },
  {
    "code": "59",
    "name": "Chapter 59 | Impregnated, coated, covered/laminated textile fabrics; textile articles for industrial use"
  },
  {
    "code": "60",
    "name": "Chapter 60 | Knitted or crocheted fabrics"
  },
  {
    "code": "61",
    "name": "Chapter 61 | Articles of apparel and clothing accessories, knitted or crocheted"
  },
  {
    "code": "62",
    "name": "Chapter 62 | Articles of apparel and clothing accessories, not knitted or crocheted"
  },
  {
    "code": "63",
    "name": "Chapter 63 | Other made up textile articles; sets; worn clothing and worn textile articles; rags"
  },
  {
    "code": "64",
    "name": "Chapter 64 | Footwear, gaiters and the like; parts of such articles"
  },
  {
    "code": "65",
    "name": "Chapter 65 | Headgear and parts thereof"
  },
  {
    "code": "66",
    "name": "Chapter 66 | Umbrellas, sun umbrellas, walking-sticks, seat-sticks, whips, riding-crops"
  },
  {
    "code": "67",
    "name": "Chapter 67 | Prepared feathers & down & articles made of feathers/down; artificial flowers; articles of human hair"
  },
  {
    "code": "68",
    "name": "Chapter 68 | Articles of stone, plaster, cement, asbestos, mica or similar materials"
  },
  {
    "code": "69",
    "name": "Chapter 69 | Ceramic products"
  },
  {
    "code": "70",
    "name": "Chapter 70 | Glass and glassware"
  },
  {
    "code": "71",
    "name": "Chapter 71 | Natural/cultured pearls, precious/semi-precious stones, precious metals & articles"
  },
  {
    "code": "72",
    "name": "Chapter 72 | Iron and steel"
  },
  {
    "code": "73",
    "name": "Chapter 73 | Articles of iron or steel"
  },
  {
    "code": "74",
    "name": "Chapter 74 | Copper and articles thereof"
  },
  {
    "code": "75",
    "name": "Chapter 75 | Nickel and articles thereof"
  },
  {
    "code": "76",
    "name": "Chapter 76 | Aluminium and articles thereof"
  },
  {
    "code": "77",
    "name": "Chapter 77 | Reserved for possible future use"
  },
  {
    "code": "78",
    "name": "Chapter 78 | Lead and articles thereof"
  },
  {
    "code": "79",
    "name": "Chapter 79 | Zinc and articles thereof"
  },
  {
    "code": "80",
    "name": "Chapter 80 | Tin and articles thereof"
  },
  {
    "code": "81",
    "name": "Chapter 81 | Other base metals; cermets; articles thereof"
  },
  {
    "code": "82",
    "name": "Chapter 82 | Tools, implements, cutlery, spoons & forks of base metal; parts thereof"
  },
  {
    "code": "83",
    "name": "Chapter 83 | Miscellaneous articles of base metal"
  },
  {
    "code": "84",
    "name": "Chapter 84 | Nuclear reactors, boilers, machinery and mechanical appliances; parts thereof"
  },
  {
    "code": "85",
    "name": "Chapter 85 | Electrical machinery & equipment and parts thereof; sound/television recorders/reproducers"
  },
  {
    "code": "86",
    "name": "Chapter 86 | Railway/tramway locomotives, rolling-stock and parts; track fixtures; traffic signalling equipment"
  },
  {
    "code": "87",
    "name": "Chapter 87 | Vehicles other than railway/tramway rolling-stock, and parts and accessories thereof"
  },
  {
    "code": "88",
    "name": "Chapter 88 | Aircraft, spacecraft, and parts thereof"
  },
  {
    "code": "89",
    "name": "Chapter 89 | Ships, boats and floating structures"
  },
  {
    "code": "90",
    "name": "Chapter 90 | Optical, photographic, cinematographic, measuring, checking, medical/surgical instruments"
  },
  {
    "code": "91",
    "name": "Chapter 91 | Clocks and watches and parts thereof"
  },
  {
    "code": "92",
    "name": "Chapter 92 | Musical instruments; parts and accessories of such articles"
  },
  {
    "code": "93",
    "name": "Chapter 93 | Arms and ammunition; parts and accessories thereof"
  },
  {
    "code": "94",
    "name": "Chapter 94 | Furniture; bedding, cushions; lamps & lighting; illuminated signs; prefabricated buildings"
  },
  {
    "code": "95",
    "name": "Chapter 95 | Toys, games and sports requisites; parts and accessories thereof"
  },
  {
    "code": "96",
    "name": "Chapter 96 | Miscellaneous manufactured articles"
  },
  {
    "code": "97",
    "name": "Chapter 97 | Works of art, collectors' pieces and antiques"
  },
  {
    "code": "98",
    "name": "Chapter 98 | Special classification provisions (national use)"
  },
  {
    "code": "99",
    "name": "Chapter 99 | Special classification provisions (national use)"
  }
];

const HEADINGS: Array<{ code: string; name: string }> = [
  {
    "code": "2201",
    "name": "2201 | Waters, mineral waters and aerated waters"
  },
  {
    "code": "2202",
    "name": "2202 | Sweetened or flavoured waters & non-alcoholic beverages"
  },
  {
    "code": "2203",
    "name": "2203 | Beer made from malt"
  },
  {
    "code": "2204",
    "name": "2204 | Wine of fresh grapes, including fortified wines"
  },
  {
    "code": "2205",
    "name": "2205 | Vermouth and other wine of fresh grapes"
  },
  {
    "code": "2206",
    "name": "2206 | Other fermented beverages (cider, perry, mead, sake)"
  },
  {
    "code": "2207",
    "name": "2207 | Undenatured ethyl alcohol of an alcoholic strength by volume of 80% vol. or higher; ethyl alcohol and other spirits, denatured, of any strength"
  },
  {
    "code": "2208",
    "name": "2208 | Undenatured ethyl alcohol of an alcoholic strength by volume of less than 80% vol.; spirits, liqueurs"
  },
  {
    "code": "2209",
    "name": "2209 | Vinegar and substitutes for vinegar obtained from acetic acid"
  }
];

const OPERATIONAL: Array<{ code: string; name: string }> = [
  { code: "GENERAL", name: "General cargo" },
  { code: "LIVE ANIMALS", name: "Live animals" },
  { code: "HAZARDOUS", name: "Dangerous goods / Hazardous" },
  { code: "PERISHABLES", name: "Perishables" },
  { code: "PHARMA", name: "Pharmaceuticals" },
];

function toItem(x: { code: string; name: string }): HsnItem {
  const code = String(x.code || "").trim();
  const name = String(x.name || "").trim();
  return { code, name, label: code && name && code !== name ? `${code} — ${name}` : (name || code) };
}

export const HSN_COMMODITIES: HsnItem[] = [
  ...OPERATIONAL.map(toItem),
  ...CHAPTERS.map(toItem),
  ...HEADINGS.map(toItem),
];

export function searchHsnCommodities(query: string, limit = 40): HsnItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return HSN_COMMODITIES.slice(0, limit);
  const scored = HSN_COMMODITIES.map((item) => {
    const hay = `${item.code} ${item.name} ${item.label}`.toLowerCase();
    let score = 0;
    if (item.code.toLowerCase() === q) score = 100;
    else if (item.code.toLowerCase().startsWith(q)) score = 80;
    else if (hay.startsWith(q)) score = 60;
    else if (hay.includes(q)) score = 40;
    return { item, score };
  }).filter((x) => x.score > 0);
  scored.sort((a, b) => b.score - a.score || a.item.code.localeCompare(b.item.code));
  return scored.slice(0, limit).map((x) => x.item);
}
