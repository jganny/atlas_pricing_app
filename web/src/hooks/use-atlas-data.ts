"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { atlasApi, useLiveData } from "@/lib/api";
import { subscribeLiveEnquiries } from "@/lib/firebase/quotes";
import { subscribeInboxEnquiries } from "@/lib/firebase/inbox";
import { subscribeDirectoryContacts } from "@/lib/firebase/directory";
import { subscribeLeads } from "@/lib/firebase/sales";
import { fetchAccounts, subscribeAccounts } from "@/lib/firebase/accounts";
import { fetchSalesContacts, subscribeSalesContacts } from "@/lib/firebase/sales-contacts";
import { fetchSalesTargets, subscribeSalesTargets } from "@/lib/firebase/sales-targets";
import { fetchSalesTerritories, subscribeSalesTerritories } from "@/lib/firebase/sales-territories";
import { mockApi } from "@/lib/mock/api";
import { mergeLocalEnquiries } from "@/lib/quotes/local-enquiries";
import { mergeCourierTariffBooks } from "@/lib/quotes/courier-tariff";
import { fetchCourierTariffBooks } from "@/lib/firebase/courier-tariffs";
import { useAuthStore } from "@/store/auth";
import type { EnquiryRecord } from "@/lib/types";
import { queryKeys } from "./query-keys";

function useQueryEnabled() {
  const user = useAuthStore((s) => s.user);
  return !useLiveData || !!user;
}

export function useEnquiries() {
  const enabled = useQueryEnabled();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || !useLiveData) return;
    const unsub = subscribeLiveEnquiries(
      (rows) => queryClient.setQueryData(queryKeys.enquiries, mergeLocalEnquiries(rows)),
      (err) => {
        console.warn("Live enquiries sync:", err.message);
        const current = queryClient.getQueryData(queryKeys.enquiries);
        if (Array.isArray(current) && current.length > 0) return;
        queryClient.setQueryData(queryKeys.enquiries, mergeLocalEnquiries([]));
        if (process.env.NODE_ENV === "development") {
          void mockApi.fetchEnquiries().then((rows) => {
            const still = queryClient.getQueryData(queryKeys.enquiries);
            if (!still || (Array.isArray(still) && still.length === 0)) {
              queryClient.setQueryData(queryKeys.enquiries, mergeLocalEnquiries(rows));
            }
          });
        }
      },
    );
    return unsub;
  }, [enabled, queryClient]);

  return useQuery({
    queryKey: queryKeys.enquiries,
    queryFn: async () => {
      try {
        const rows = await atlasApi.fetchEnquiries();
        if (
          useLiveData &&
          process.env.NODE_ENV === "development" &&
          rows.length === 0
        ) {
          // Dev preview user often lacks Firestore read — show mock for UI testing.
          return mergeLocalEnquiries(await mockApi.fetchEnquiries());
        }
        return mergeLocalEnquiries(rows);
      } catch (err) {
        const current = queryClient.getQueryData(queryKeys.enquiries);
        if (Array.isArray(current) && current.length > 0) return current as EnquiryRecord[];
        if (process.env.NODE_ENV === "development") {
          return mergeLocalEnquiries(await mockApi.fetchEnquiries());
        }
        throw err;
      }
    },
    staleTime: useLiveData ? Infinity : 60_000,
    retry: 1,
    enabled,
  });
}

export function useInbox() {
  const enabled = useQueryEnabled();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || !useLiveData) return;
    const unsub = subscribeInboxEnquiries(
      (rows) => queryClient.setQueryData(queryKeys.inbox, rows),
      (err) => {
        console.warn("Inbox sync:", err.message);
        if (process.env.NODE_ENV === "development") {
          void mockApi.fetchInbox().then((rows) => {
            const current = queryClient.getQueryData(queryKeys.inbox);
            if (!current || (Array.isArray(current) && current.length === 0)) {
              queryClient.setQueryData(queryKeys.inbox, rows);
            }
          });
        }
      },
    );
    return unsub;
  }, [enabled, queryClient]);

  return useQuery({
    queryKey: queryKeys.inbox,
    queryFn: async () => {
      try {
        const rows = await atlasApi.fetchInbox();
        if (useLiveData && process.env.NODE_ENV === "development" && rows.length === 0) {
          return mockApi.fetchInbox();
        }
        return rows;
      } catch {
        if (process.env.NODE_ENV === "development") return mockApi.fetchInbox();
        return [];
      }
    },
    staleTime: useLiveData ? 30_000 : 60_000,
    retry: 1,
    enabled,
  });
}

export function useAirTariffs() {
  const enabled = useQueryEnabled();
  return useQuery({
    queryKey: queryKeys.airTariffs,
    queryFn: () => atlasApi.fetchAirTariffs(),
    staleTime: 5 * 60_000,
    retry: 1,
    enabled,
  });
}

export function useSeaTariffs() {
  const enabled = useQueryEnabled();
  return useQuery({
    queryKey: queryKeys.seaTariffs,
    queryFn: () => atlasApi.fetchSeaTariffs(),
    staleTime: 5 * 60_000,
    retry: 1,
    enabled,
  });
}

export function useCourierTariffs() {
  const enabled = useQueryEnabled();
  return useQuery({
    queryKey: queryKeys.courierTariffs,
    queryFn: async () => {
      try {
        if (useLiveData) {
          return mergeCourierTariffBooks(await fetchCourierTariffBooks());
        }
      } catch {
        /* fall through to local */
      }
      return mergeCourierTariffBooks([]);
    },
    staleTime: 60_000,
    retry: 1,
    enabled,
  });
}

export function useCirculars() {
  const enabled = useQueryEnabled();
  return useQuery({
    queryKey: queryKeys.circulars,
    queryFn: () => atlasApi.fetchCirculars(),
    staleTime: 5 * 60_000,
    retry: 1,
    enabled,
  });
}

export function useLeads() {
  const enabled = useQueryEnabled();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || !useLiveData) return;
    const unsub = subscribeLeads(
      (rows) => {
        if (rows.length > 0) queryClient.setQueryData(queryKeys.leads, rows);
        else if (process.env.NODE_ENV === "development") {
          void mockApi.fetchLeads().then((mockRows) => {
            const current = queryClient.getQueryData(queryKeys.leads);
            if (!current || (Array.isArray(current) && current.length === 0)) {
              queryClient.setQueryData(queryKeys.leads, mockRows);
            }
          });
        }
      },
      (err) => {
        console.warn("Leads sync:", err.message);
        if (process.env.NODE_ENV === "development") {
          void mockApi.fetchLeads().then((rows) => {
            const current = queryClient.getQueryData(queryKeys.leads);
            if (!current || (Array.isArray(current) && current.length === 0)) {
              queryClient.setQueryData(queryKeys.leads, rows);
            }
          });
        }
      },
    );
    return unsub;
  }, [enabled, queryClient]);

  return useQuery({
    queryKey: queryKeys.leads,
    queryFn: () => atlasApi.fetchLeads(),
    staleTime: useLiveData ? Infinity : 60_000,
    retry: 1,
    enabled,
  });
}

export function useAccounts() {
  const enabled = useQueryEnabled();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || !useLiveData) return;
    const unsub = subscribeAccounts(
      (rows) => queryClient.setQueryData(queryKeys.accounts, rows),
      (err) => console.warn("Accounts sync:", err.message),
    );
    return unsub;
  }, [enabled, queryClient]);

  return useQuery({
    queryKey: queryKeys.accounts,
    queryFn: () => fetchAccounts(),
    staleTime: useLiveData ? Infinity : 60_000,
    retry: 1,
    enabled,
  });
}

export function useSalesContacts(accountId: string | undefined) {
  const enabled = useQueryEnabled() && Boolean(accountId);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || !useLiveData || !accountId) return;
    const unsub = subscribeSalesContacts(
      accountId,
      (rows) => queryClient.setQueryData(queryKeys.salesContacts(accountId), rows),
      (err) => console.warn("Sales contacts sync:", err.message),
    );
    return unsub;
  }, [enabled, accountId, queryClient]);

  return useQuery({
    queryKey: queryKeys.salesContacts(accountId || ""),
    queryFn: () => fetchSalesContacts(accountId || ""),
    staleTime: useLiveData ? Infinity : 60_000,
    retry: 1,
    enabled,
  });
}

export function useSalesTargets() {
  const enabled = useQueryEnabled();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || !useLiveData) return;
    const unsub = subscribeSalesTargets(
      (rows) => queryClient.setQueryData(queryKeys.salesTargets, rows),
      (err) => console.warn("Sales targets sync:", err.message),
    );
    return unsub;
  }, [enabled, queryClient]);

  return useQuery({
    queryKey: queryKeys.salesTargets,
    queryFn: () => fetchSalesTargets(),
    staleTime: useLiveData ? Infinity : 60_000,
    retry: 1,
    enabled,
  });
}

export function useSalesTerritories() {
  const enabled = useQueryEnabled();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || !useLiveData) return;
    const unsub = subscribeSalesTerritories(
      (rows) => queryClient.setQueryData(queryKeys.salesTerritories, rows),
      (err) => console.warn("Sales territories sync:", err.message),
    );
    return unsub;
  }, [enabled, queryClient]);

  return useQuery({
    queryKey: queryKeys.salesTerritories,
    queryFn: () => fetchSalesTerritories(),
    staleTime: useLiveData ? Infinity : 60_000,
    retry: 1,
    enabled,
  });
}

export function useCreditControls() {
  const enabled = useQueryEnabled();
  return useQuery({
    queryKey: queryKeys.credit,
    queryFn: () => atlasApi.fetchCreditControls(),
    staleTime: 60_000,
    retry: 1,
    enabled,
  });
}

export function useDirectory() {
  const enabled = useQueryEnabled();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || !useLiveData) return;
    const unsub = subscribeDirectoryContacts(
      (rows) => {
        if (rows.length > 0) {
          queryClient.setQueryData(queryKeys.directory, rows);
          return;
        }
        const current = queryClient.getQueryData(queryKeys.directory);
        if (Array.isArray(current) && current.length > 0) return;
        // Empty live collection in preview — seed mock so the CRM UI is usable.
        if (process.env.NODE_ENV === "development") {
          void mockApi.fetchDirectory().then((mockRows) => {
            const still = queryClient.getQueryData(queryKeys.directory);
            if (!still || (Array.isArray(still) && still.length === 0)) {
              queryClient.setQueryData(queryKeys.directory, mockRows);
            }
          });
        } else {
          queryClient.setQueryData(queryKeys.directory, rows);
        }
      },
      (err) => {
        console.warn("Directory sync:", err.message);
        if (process.env.NODE_ENV === "development") {
          void mockApi.fetchDirectory().then((rows) => {
            const current = queryClient.getQueryData(queryKeys.directory);
            if (!current || (Array.isArray(current) && current.length === 0)) {
              queryClient.setQueryData(queryKeys.directory, rows);
            }
          });
        }
      },
    );
    return unsub;
  }, [enabled, queryClient]);

  return useQuery({
    queryKey: queryKeys.directory,
    queryFn: async () => {
      try {
        const rows = await atlasApi.fetchDirectory();
        if (useLiveData && process.env.NODE_ENV === "development" && rows.length === 0) {
          return mockApi.fetchDirectory();
        }
        return rows;
      } catch {
        if (process.env.NODE_ENV === "development") return mockApi.fetchDirectory();
        return [];
      }
    },
    staleTime: useLiveData ? Infinity : 60_000,
    retry: 1,
    enabled,
  });
}
