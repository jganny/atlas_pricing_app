import { hasFirebaseConfig, isMockMode } from "@/lib/env";
import { mockApi } from "@/lib/mock/api";
import { firebaseLogin, firebaseLogout } from "@/lib/firebase/auth";
import { fetchLiveCirculars } from "@/lib/firebase/circulars";
import { fetchLiveEnquiries } from "@/lib/firebase/quotes";
import {
  fetchLiveAirTariffs,
  fetchLiveSeaTariffs,
  lookupAirTariff as lookupLiveAirTariff,
  lookupSeaTariff as lookupLiveSeaTariff,
} from "@/lib/firebase/tariffs";
import {
  parseAirEnquiry,
  parseSeaEnquiry,
} from "@/lib/pricing/parse-enquiry";
import {
  estimateAirFreightFromTariff,
  estimateSeaFreightFromTariff,
} from "@/lib/pricing/estimate";
import type {
  AirTariff,
  AuthUser,
  CircularRecord,
  EnquiryRecord,
  SeaTariff,
  SmartQuoteDraft,
} from "@/lib/types";

export const useLiveData = !isMockMode && hasFirebaseConfig;

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(fallback);
      });
  });
}

export function getEnvironmentLabel(): string {
  if (isMockMode) return "Mock environment";
  if (!hasFirebaseConfig) return "Live mode (Firebase config missing)";
  return "Live Firebase";
}

async function login(username: string, password: string): Promise<AuthUser> {
  if (useLiveData) return firebaseLogin(username, password);
  return mockApi.login(username, password);
}

async function logout(): Promise<void> {
  if (useLiveData) await firebaseLogout();
}

async function fetchEnquiries(): Promise<EnquiryRecord[]> {
  if (useLiveData) return fetchLiveEnquiries();
  return mockApi.fetchEnquiries();
}

async function fetchAirTariffs(): Promise<AirTariff[]> {
  if (useLiveData) {
    return withTimeout(fetchLiveAirTariffs(), 6000, []);
  }
  return mockApi.fetchAirTariffs();
}

async function fetchSeaTariffs(): Promise<SeaTariff[]> {
  if (useLiveData) {
    return withTimeout(fetchLiveSeaTariffs(), 6000, []);
  }
  return mockApi.fetchSeaTariffs();
}

async function fetchCirculars(): Promise<CircularRecord[]> {
  if (useLiveData) {
    return withTimeout(fetchLiveCirculars(), 6000, []);
  }
  return [];
}

async function resolveAirTariffs(cached?: AirTariff[]): Promise<AirTariff[]> {
  // Undefined = not loaded yet. Empty array = already fetched (do not wait again).
  if (cached !== undefined) return cached;
  return withTimeout(fetchLiveAirTariffs(), 2500, []);
}

async function resolveSeaTariffs(cached?: SeaTariff[]): Promise<SeaTariff[]> {
  if (cached !== undefined) return cached;
  return withTimeout(fetchLiveSeaTariffs(), 2500, []);
}

async function runAirSmartQuote(text: string, airTariffs?: AirTariff[]): Promise<SmartQuoteDraft> {
  if (!useLiveData) return mockApi.runAirSmartQuote(text);

  // Parse first — never block the UI on Firebase.
  const parsed = parseAirEnquiry(text);
  if (!parsed.origin || !parsed.destination) {
    return {
      parsed,
      tariffFound: false,
      carrierLabel: parsed.airlineLabel || "—",
      message: "Could not detect POL/POD. Include airport codes (BLR, LHR…).",
    };
  }

  const tariffs = await resolveAirTariffs(airTariffs);

  const tariff = lookupLiveAirTariff(
    tariffs,
    parsed.origin,
    parsed.destination,
    parsed.airline,
  );
  const carrierLabel = parsed.airlineLabel || tariff?.carrier || "From route history";
  let estimatedTotal: number | undefined;
  let tariffNote = "";

  if (tariff) {
    try {
      estimatedTotal = estimateAirFreightFromTariff(parsed, tariff);
    } catch {
      tariffNote = " · estimate skipped";
    }
  } else if (!tariffs.length) {
    tariffNote = " · Circulars timed out or empty — enter rates on desk";
  }

  return {
    parsed,
    tariffFound: Boolean(tariff),
    carrierLabel,
    estimatedTotal,
    currency: tariff?.currency,
    airBreaks: tariff?.breaks,
    message: tariff
      ? `Draft ready · ${parsed.origin} → ${parsed.destination} · rates from Circulars${tariffNote}`
      : `Draft ready · ${parsed.origin} → ${parsed.destination} · no Circulars match — enter rates manually${tariffNote}`,
  };
}

async function runSeaSmartQuote(text: string, seaTariffs?: SeaTariff[]): Promise<SmartQuoteDraft> {
  if (!useLiveData) return mockApi.runSeaSmartQuote(text);

  const parsed = parseSeaEnquiry(text);
  if (!parsed.origin || !parsed.destination) {
    return {
      parsed,
      tariffFound: false,
      carrierLabel: parsed.linerLabel || "—",
      message: "Could not detect POL/POD. Include UN/LOCODE (INNSA, NLRTM…).",
    };
  }

  const tariffs = await resolveSeaTariffs(seaTariffs);

  const tariff = lookupLiveSeaTariff(
    tariffs,
    parsed.origin,
    parsed.destination,
    parsed.mode,
  );
  const carrierLabel = parsed.linerLabel || tariff?.carrier || "From route history";
  let estimatedTotal: number | undefined;
  let tariffNote = "";

  if (tariff) {
    try {
      estimatedTotal = estimateSeaFreightFromTariff(parsed, tariff);
    } catch {
      tariffNote = " · estimate skipped";
    }
  } else if (!tariffs.length) {
    tariffNote = " · Circulars timed out or empty — enter rates on desk";
  }

  return {
    parsed,
    tariffFound: Boolean(tariff),
    carrierLabel,
    estimatedTotal,
    currency: tariff?.currency,
    seaTariff: tariff
      ? {
          mode: tariff.mode,
          lclRate: tariff.lclRate,
          fclRates: tariff.fclRates,
          currency: tariff.currency,
          carrier: tariff.carrier,
        }
      : undefined,
    message: tariff
      ? `Sea draft ready · ${parsed.origin} → ${parsed.destination} · ${tariff.mode.toUpperCase()} from Circulars${tariffNote}`
      : `Sea draft ready · ${parsed.origin} → ${parsed.destination} · no Circulars match — enter rates on Carriers tab${tariffNote}`,
  };
}

export const atlasApi = {
  login,
  logout,
  fetchEnquiries,
  fetchAirTariffs,
  fetchSeaTariffs,
  fetchCirculars,
  runAirSmartQuote,
  runSeaSmartQuote,
  getEnvironmentLabel,
};
