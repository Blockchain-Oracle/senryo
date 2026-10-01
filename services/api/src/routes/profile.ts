import { handleAvailableRoute, myProfileRoute, profileGetRoute, profilePutRoute } from "@senryo/api-client";
import { HTTP_STATUS, HttpError, type HttpServer, parseRoute, sendRoute } from "@senryo/service-common";
import { SingleFlight } from "../single-flight.ts";
import { HANDLE_CHECK_RATE, PROFILE_READ_RATE, PROFILE_WRITE_RATE } from "../social/constants.ts";
import { handleAvailability, publicProfile, readProfile, saveProfile } from "../social/profiles.ts";
import type { SocialServices } from "../social/runtime.ts";
import { myProfileOf, type ProfileRow, requireSession, type SocialContext } from "../social/shared.ts";

/** A listing or trade sharing went from on to off (the account leaves cached boards at once). */
function narrowed(before: ProfileRow | undefined, after: ProfileRow): boolean {
  if (!before) return false;
  const flags = ["listed_practice", "listed_mainnet", "public_trades_practice", "public_trades_mainnet"] as const;
  return flags.some((flag) => before[flag] && !after[flag]);
}

/**
 * Handles and profiles (S12b.2, D-174). Writes need a session for the same address (the session IS the profile).
 * `GET /v1/profile/:handleOrAddress?chainId` never reveals a profile — handle included — that isn't listed on that
 * network: unlisted and absent both answer 404.
 */
export function registerProfileRoutes(
  app: HttpServer,
  ctx: SocialContext & { social?: Pick<SocialServices, "leaderboard"> },
): void {
  const writes = new SingleFlight("a profile update for this account is in flight");

  app.get(handleAvailableRoute.path, { config: { rateLimit: HANDLE_CHECK_RATE } }, async (request, reply) => {
    const { params } = parseRoute(handleAvailableRoute, request);
    return sendRoute(reply, handleAvailableRoute, await handleAvailability(ctx.db, params.h));
  });

  app.get(myProfileRoute.path, { config: { rateLimit: PROFILE_READ_RATE } }, async (request, reply) => {
    const s = await requireSession(ctx, request);
    const row = await readProfile(ctx.db, s.address.toLowerCase());
    return sendRoute(reply, myProfileRoute, { profile: row ? myProfileOf(row) : null });
  });

  app.put(profilePutRoute.path, { config: { rateLimit: PROFILE_WRITE_RATE } }, async (request, reply) => {
    const s = await requireSession(ctx, request);
    const { body } = parseRoute(profilePutRoute, request);
    const address = s.address.toLowerCase();
    const before = await readProfile(ctx.db, address);
    const row = await writes.run(address, () => saveProfile(ctx.db, address, body));
    if (narrowed(before, row)) ctx.social?.leaderboard.forget(address);
    return sendRoute(reply, profilePutRoute, myProfileOf(row));
  });

  app.get(profileGetRoute.path, { config: { rateLimit: PROFILE_READ_RATE } }, async (request, reply) => {
    const { params, query } = parseRoute(profileGetRoute, request);
    const profile = await publicProfile(ctx.db, query.chainId, params.handleOrAddress);
    if (!profile) throw new HttpError(HTTP_STATUS.notFound, "NOT_FOUND", "no public profile on this network");
    return sendRoute(reply, profileGetRoute, profile);
  });
}
