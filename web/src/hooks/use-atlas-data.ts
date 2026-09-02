"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { atlasApi, useLiveData } from "@/lib/api";
import { subscribeLiveEnquiries } from "@/lib/firebase/quotes";
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
      (err) => console.warn("Live enquiries sync:", err.message),
    );
    return unsub;
  }, [enabled, queryClient]);

  return useQuery({
    queryKey: queryKeys.enquiries,
    queryFn: () => atlasApi.fetchEnquiries(),
    staleTime: useLiveData ? Infinity : 60_000,
    enabled,
  });
}

export function useAirTariffs() {
  const enabled = useQueryEnabled();
  return useQuery({
    queryKey: queryKeys.airTariffs,
    queryFn: () => atlasApi.fetchAirTariffs(),
    staleTime: 5 * 60_000,
    enabled,
  });
}

export function useSeaTariffs() {
  const enabled = useQueryEnabled();
  return useQuery({
    queryKey: queryKeys.seaTariffs,
    queryFn: () => atlasApi.fetchSeaTariffs(),
    staleTime: 5 * 60_000,
    enabled,
  });
}

export function useCirculars() {
  const enabled = useQueryEnabled();
  return useQuery({
    queryKey: queryKeys.circulars,
    queryFn: () => atlasApi.fetchCirculars(),
    staleTime: 5 * 60_000,
    enabled,
  });
}
