/**
 * The sends behind a move of any asset on Monad (B7/B8) live in `@senryo/query` (`money-requests.ts`), shared with the
 * web; this module keeps the phone's import path.
 */
export { moveSteps, pullToSelfStep, splitSource, transferRequest } from "@senryo/query";
