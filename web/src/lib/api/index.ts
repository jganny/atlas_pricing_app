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
  estimateAirTotal,
  parseAirEnquiry,
  parseSeaEnquiry,
} from "@/lib/pricing/parse-enquiry";
import type {
  AirTariff,
  AuthUser,
  CircularRecord,
  EnquiryRecord,
  SeaTariff,
  SmartQuoteDraft,
} from "@/lib/types";

export const useLiveData = !isMockMode && hasFirebaseConfig;

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
    try {
      return await fetchLiveAirTariffs();
    } catch {
      return [];
    }
  }
  return mockApi.fetchAirTariffs();
}

async function fetchSeaTariffs(): Promise<SeaTariff[]> {
  if (useLiveData) {
    try {
      return await fetchLiveSeaTariffs();
    } catch {
      return [];
    }
  }
  return mockApi.fetchSeaTariffs();
}

async function fetchCirculars(): Promise<CircularRecord[]> {
  if (useLiveData) {
    try {
      return await fetchLiveCirculars();
    } catch {
      return [];
    }
  }
  return [];
}

async function runAirSmartQuote(text: string, airTariffs?: AirTariff[]): Promise<SmartQuoteDraft> {
  if (!useLiveData) return mockApi.runAirSmartQuote(text);

  const parsed = parseAirEnquiry(text);
  if (!parsed.origin || !parsed.destination) {
    return {
      parsed,
      tariffFound: false,
      carrierLabel: parsed.airlineLabel || "—",
      message: "Could not detect POL/POD. Include airport codes (BLR, LHR…).",
    };
  }

  const tariffs = airTariffs ?? (await fetchAirTariffs());
  const tariff = lookupLiveAirTariff(
    tariffs,
    parsed.origin,
    parsed.destination,
    parsed.airline,
  );
  const carrierLabel = parsed.airlineLabel || tariff?.carrier || "From route history";
  let estimatedTotal: number | undefined;

  if (tariff) {
    estimatedTotal = estimateAirTotal(parsed.packages, tariff.breaks).freight;
  }

  return {
    parsed,
    tariffFound: Boolean(tariff),
    carrierLabel,
    estimatedTotal,
    message: tariff
      ? `Draft ready · ${parsed.origin} → ${parsed.destination} · rates from Circulars`
      : `Draft ready · no Circulars tariff — enter rates manually (CWT still auto)`,
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

  const tariffs = seaTariffs ?? (await fetchSeaTariffs());
  const tariff = lookupLiveSeaTariff(
    tariffs,
    parsed.origin,
    parsed.destination,
    parsed.mode,
  );
  const carrierLabel = parsed.linerLabel || tariff?.carrier || "From route history";
  let estimatedTotal: number | undefined;

  if (tariff?.mode === "fcl" && parsed.containers.length) {
    estimatedTotal = parsed.containers.reduce((sum, c) => {
      const rate = tariff.fclRates[c.type]?.sell || 0;
      return sum + rate * c.qty;
    }, 0);
  } else if (tariff?.mode === "lcl") {
    const rt = Math.max((parsed.grossWeight || 0) / 1000, parsed.volume || 0, 1);
    estimatedTotal = rt * tariff.lclRate.sell;
  }

  return {
    parsed,
    tariffFound: Boolean(tariff),
    carrierLabel,
    estimatedTotal,
    message: tariff
      ? `Sea draft ready · ${parsed.origin} → ${parsed.destination} · ${tariff.mode.toUpperCase()} from Circulars`
      : `Sea draft ready · no Circulars tariff — enter rates on Carriers tab`,
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
