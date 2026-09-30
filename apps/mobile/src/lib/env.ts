import { parsePublicEnv } from "@senryo/config";

/** Public env (EXPO_PUBLIC_* are inlined at bundle time; unset → production hosts). Never secrets. */
export const ENV = parsePublicEnv({
  API_ORIGIN: process.env.EXPO_PUBLIC_API_ORIGIN,
  INDEXER_ORIGIN: process.env.EXPO_PUBLIC_INDEXER_ORIGIN,
});
