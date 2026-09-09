/** Industry headlines for the desk ticker (RSS live wire optional). */

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  url: string;
  region: "global" | "india";
  publishedAt: string;
  summary: string;
}

export const MOCK_LOGISTICS_NEWS: NewsItem[] = [
  {
    id: "n1",
    title: "Asia–Europe ocean rates firm on Red Sea diversions",
    source: "Container News",
    url: "https://container-news.com/",
    region: "global",
    publishedAt: new Date().toISOString(),
    summary: "Carriers hold GRIs as transit times stretch via Cape of Good Hope.",
  },
  {
    id: "n2",
    title: "India air cargo uplift for pharma peak season",
    source: "Logistics Insider",
    url: "https://www.logisticsinsider.in/",
    region: "india",
    publishedAt: new Date(Date.now() - 86400000).toISOString(),
    summary: "Delhi and Mumbai freighters report stronger westbound demand.",
  },
  {
    id: "n3",
    title: "JNPA berth productivity hits monthly high",
    source: "Maritime India",
    url: "https://www.logisticsinsider.in/",
    region: "india",
    publishedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    summary: "Port authority cites crane moves and gate turnaround improvements.",
  },
  {
    id: "n4",
    title: "Jet fuel eases week-on-week — re-check FSC before long-validity air quotes",
    source: "Vertex desk",
    url: "https://www.iata.org/en/publications/economics/",
    region: "global",
    publishedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    summary: "Desk tip: re-check Circulars FSC before locking long-validity air quotes.",
  },
  {
    id: "n5",
    title: "USWC congestion watch as import boxes bunch after holidays",
    source: "Journal of Commerce",
    url: "https://www.joc.com/",
    region: "global",
    publishedAt: new Date(Date.now() - 4 * 86400000).toISOString(),
    summary: "Schedule reliability still uneven on transpacific loops.",
  },
  {
    id: "n6",
    title: "IATA: air cargo volumes hold above 2019 baseline",
    source: "IATA",
    url: "https://www.iata.org/en/pressroom/",
    region: "global",
    publishedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    summary: "E-commerce and perishables keep widebody bellies busy on Asia–Europe.",
  },
];
