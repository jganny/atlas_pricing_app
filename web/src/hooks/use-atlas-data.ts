"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { atlasApi, useLiveData } from "@/lib/api";
import { subscribeLiveEnquiries } from "@/lib/firebase/quotes";
import { subscribeInboxEnquiries } from "@/lib/firebase/inbox";
import { mockApi } from "@/lib/mock/api";
import { useAuthStore } from "@/store/auth";
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
      (rows) => queryClient.setQueryData(queryKeys.enquiries, rows),
      (err) => {
        console.warn("Live enquiries sync:", err.message);
        // Preview / unauthenticated Firebase: keep UI usable with mock sample rows.
        if (process.env.NODE_ENV === "development") {
          void mockApi.fetchEnquiries().then((rows) => {
            const current = queryClient.getQueryData(queryKeys.enquiries);
            if (!current || (Array.isArray(current) && current.length === 0)) {
              queryClient.setQueryData(queryKeys.enquiries, rows);
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
          return mockApi.fetchEnquiries();
        }
        return rows;
      } catch {
        if (process.env.NODE_ENV === "development") return mockApi.fetchEnquiries();
        return [];
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
