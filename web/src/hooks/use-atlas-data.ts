"use client";

import { useQuery } from "@tanstack/react-query";
import { atlasApi, useLiveData } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { queryKeys } from "./query-keys";

function useQueryEnabled() {
  const user = useAuthStore((s) => s.user);
  return !useLiveData || !!user;
}

export function useEnquiries() {
  const enabled = useQueryEnabled();
  return useQuery({
    queryKey: queryKeys.enquiries,
    queryFn: () => atlasApi.fetchEnquiries(),
    staleTime: 60_000,
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
