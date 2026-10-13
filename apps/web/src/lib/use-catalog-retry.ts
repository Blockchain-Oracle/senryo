"use client";
/**
 * Whether the market catalogue failed to load, and a Try again that asks for it now (D4, the owner's review: screens
 * that only said "loading" forever). The catalogue keeps retrying on its own; this lets the reader not wait for it.
 */
import { marketKeys, useCatalog, useQueryEnv } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";

export function useCatalogRetry(): { failed: boolean; retry: () => void } {
  const catalog = useCatalog();
  const client = useQueryClient();
  const { chainId } = useQueryEnv();
  return {
    failed: catalog.status === "failed",
    retry: () => void client.invalidateQueries({ queryKey: marketKeys.catalog(chainId) }),
  };
}
