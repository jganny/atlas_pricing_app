"use client";

import { useMutation } from "@tanstack/react-query";
import { atlasApi } from "@/lib/api";
import { useAirTariffs, useSeaTariffs } from "./use-atlas-data";

export function useAirSmartQuote() {
  const { data: airTariffs } = useAirTariffs();
  return useMutation({
    mutationFn: (text: string) => atlasApi.runAirSmartQuote(text, airTariffs),
  });
}

export function useSeaSmartQuote() {
  const { data: seaTariffs } = useSeaTariffs();
  return useMutation({
    mutationFn: (text: string) => atlasApi.runSeaSmartQuote(text, seaTariffs),
  });
}
