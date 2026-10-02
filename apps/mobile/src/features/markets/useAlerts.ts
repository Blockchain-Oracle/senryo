/**
 * Price alerts (D-034) on the Senryo api: list, create, remove (`/v1/alerts`, session routes). An alert lives on the
 * server and belongs to the account on one network; the keeper checks every active alert against the accepted oracle
 * price and marks it `triggered`, then pushes to the account's registered devices. Nothing is kept on the phone, so an
 * alert set here is never a local reminder that cannot fire.
 *
 * Session rules: the list loads only while the trading session is unlocked (signing in to the api is then silent), so
 * opening Alerts never raises Face ID by itself; saving or removing may unlock, because the user asked for it.
 */
import { classifyAuthError, isSilent } from "@senryo/account";
import { type Alert, ApiError, alertsCreateRoute, alertsDeleteRoute, alertsListRoute } from "@senryo/api-client";
import { fromQuery, type Reading } from "@senryo/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, withSession } from "~/lib/account/api";
import { useAccount } from "~/lib/account/provider";
import { useNetwork } from "~/lib/network";

export type { Alert };

/** A triggered alert shows up without a pull: the list re-reads this often while a screen shows it. */
const ALERTS_REFETCH_MS = 30_000;

const alertsKey = (chainId: number, address: string) => ["alerts", chainId, address.toLowerCase()] as const;

/** `guest`: no account on this phone. `locked`: an account whose session must be unlocked to read its alerts. */
export type AlertsAccess = "guest" | "locked" | "ready";

export interface AlertDraft {
  marketId: number;
  direction: Alert["direction"];
  price18: bigint;
  /** Edit (C9): the alert this one replaces, cancelled in the same server transaction. */
  replaces?: string;
}

export function useAlerts(): { access: AlertsAccess; reading: Reading<Alert[]>; refetch: () => void } {
  const account = useAccount();
  const network = useNetwork();
  const address = account.hint?.address;
  const access: AlertsAccess = !address ? "guest" : account.snapshot.status === "unlocked" ? "ready" : "locked";
  const client = account.client;
  const faceId = account.settings.faceId;
  const query = useQuery({
    queryKey: alertsKey(network.chainId, address ?? ""),
    queryFn: async (): Promise<Alert[]> => {
      if (!client) throw new Error("no account on this device");
      const { alerts } = await withSession(client, faceId, () => api().call(alertsListRoute, {}));
      // The api session is per network already; this keeps the other network's alerts out even if that changes.
      return alerts.filter((a) => a.chainId === network.chainId);
    },
    enabled: access === "ready" && client !== undefined,
    staleTime: ALERTS_REFETCH_MS,
    refetchInterval: ALERTS_REFETCH_MS,
  });
  return { access, reading: fromQuery(query), refetch: () => void query.refetch() };
}

/** Saves a new alert on the active network (or replaces one) and updates the cached list. */
export function useCreateAlert() {
  const account = useAccount();
  const network = useNetwork();
  const cache = useQueryClient();
  const address = account.hint?.address;
  const client = account.client;
  const faceId = account.settings.faceId;
  return useMutation({
    mutationFn: (draft: AlertDraft): Promise<Alert> => {
      if (!client) return Promise.reject(new Error("no account on this device"));
      return withSession(client, faceId, () =>
        api().call(alertsCreateRoute, { body: { chainId: network.chainId, ...draft } }),
      );
    },
    onSuccess: async (alert, draft) => {
      if (!address) return;
      const key = alertsKey(network.chainId, address);
      // Shown at once in a list that was loaded; a list never loaded is not seeded with one alert (it would read as
      // the whole list). Either way the server's list is read again.
      cache.setQueryData<Alert[]>(key, (prev) =>
        prev ? [alert, ...prev.filter((a) => a.id !== draft.replaces)] : prev,
      );
      await cache.invalidateQueries({ queryKey: key });
    },
  });
}

/** Removes (cancels) an alert and drops it from the cached list. */
export function useRemoveAlert() {
  const account = useAccount();
  const network = useNetwork();
  const cache = useQueryClient();
  const address = account.hint?.address;
  const client = account.client;
  const faceId = account.settings.faceId;
  return useMutation({
    mutationFn: (id: string): Promise<Alert> => {
      if (!client) return Promise.reject(new Error("no account on this device"));
      return withSession(client, faceId, () => api().call(alertsDeleteRoute, { params: { id } }));
    },
    onSuccess: (removed) => {
      if (!address) return;
      cache.setQueryData<Alert[]>(alertsKey(network.chainId, address), (prev) =>
        prev ? prev.filter((a) => a.id !== removed.id) : prev,
      );
    },
  });
}

/** Why a save or removal failed, in the user's words; nothing when they cancelled Face ID (a cancel is not an error). */
export function alertErrorCopy(error: unknown): string | undefined {
  if (!(error instanceof ApiError) && isSilent(classifyAuthError(error))) return undefined;
  if (error instanceof ApiError && error.code === "CONFLICT") return "50 alerts max · remove one";
  if (error instanceof ApiError && error.code === "NOT_FOUND") return "Alert already removed";
  return "Not saved · Retry";
}
