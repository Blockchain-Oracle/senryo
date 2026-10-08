import { createApiClient, type MyProfile, myProfileSchema } from "@senryo/api-client";
import { TESTNET_CHAIN_ID } from "@senryo/config";
import { storage } from "~/lib/storage";
import { DEV_ORIGIN, requireDevWorkspace } from "./config";

let profile: MyProfile | undefined;
const PROFILE_KEY = "senryo.dev-profile.v1";
export function setDevProfileAddress(address: MyProfile["address"]): void {
  requireDevWorkspace();
  if (!profile) {
    try {
      const saved = myProfileSchema.safeParse(JSON.parse(storage.getString(PROFILE_KEY) ?? "null"));
      if (saved.success && saved.data.address.toLowerCase() === address.toLowerCase()) profile = saved.data;
    } catch {
      /* A malformed development fixture resets to the default. */
    }
  }
  profile ??= {
    address,
    handle: "senryo_dev",
    displayName: "Senryo Dev",
    bio: "Local development workspace",
    avatar: null,
    listedPractice: true,
    listedMainnet: false,
    publicTradesPractice: false,
    publicTradesMainnet: false,
    handleChangedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  storage.set(PROFILE_KEY, JSON.stringify(profile));
}

export function resetDevProfile(): void {
  requireDevWorkspace();
  profile = undefined;
  storage.remove(PROFILE_KEY);
}

/** Local service fixtures use the production route schemas. Unsupported actions fail explicitly; no external writes. */
export const devApi = createApiClient({
  origin: DEV_ORIGIN,
  getToken: () => "local-development-only",
  fetch: async (input, init) => {
    requireDevWorkspace();
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : undefined;
    const path = url.pathname.startsWith("/v1/handles/")
      ? "/v1/handles/:h/available"
      : url.pathname.startsWith("/v1/profile/")
        ? "/v1/profile/:handleOrAddress"
        : url.pathname;
    let response: unknown;
    switch (path) {
      case "/v1/geo":
        response = { country: null, realMoneyAllowed: false, reason: "Local workspace" };
        break;
      case "/v1/profile":
        if (method === "PUT" && profile) {
          profile = myProfileSchema.parse({ ...profile, ...body, updatedAt: new Date().toISOString() });
          storage.set(PROFILE_KEY, JSON.stringify(profile));
        }
        response = method === "PUT" ? profile : { profile: profile ?? null };
        break;
      case "/v1/profile/:handleOrAddress": {
        const saved = myProfileSchema.safeParse(JSON.parse(storage.getString(PROFILE_KEY) ?? "null"));
        const shown = profile ?? (saved.success ? saved.data : undefined);
        const lookup = decodeURIComponent(url.pathname.split("/")[3] ?? "").toLowerCase();
        if (
          !shown ||
          (lookup !== shown.address.toLowerCase() && lookup !== shown.handle?.toLowerCase()) ||
          url.searchParams.get("chainId") !== String(TESTNET_CHAIN_ID)
        )
          throw new Error("No such local fixture profile");
        response = {
          chainId: TESTNET_CHAIN_ID,
          address: shown.address,
          handle: shown.handle,
          displayName: shown.displayName,
          bio: shown.bio,
          avatar: shown.avatar,
          publicTrades: shown.publicTradesPractice,
          followers: 0,
          following: 0,
          createdAt: shown.createdAt,
        };
        break;
      }
      case "/v1/handles/:h/available":
        response = {
          handle: decodeURIComponent(url.pathname.split("/")[3] ?? ""),
          state: "available",
          reason: null,
          heldUntil: null,
        };
        break;
      case "/v1/me/follow-counts":
        response = { followers: 0, following: 0 };
        break;
      case "/v1/feed":
        response = { items: [], nextCursor: null };
        break;
      case "/v1/prefs":
        response = { blob: null };
        break;
      default:
        throw new Error(`Development fixture not configured: ${method} ${path}`);
    }
    return new Response(
      JSON.stringify(response, (_key, value) => (typeof value === "bigint" ? value.toString() : value)),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  },
});
