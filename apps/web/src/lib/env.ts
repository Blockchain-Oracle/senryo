import { parsePublicEnv } from "@senryo/config";

/** Public env (NEXT_PUBLIC_* are inlined at build; unset → production hosts). Never secrets. */
export const ENV = parsePublicEnv({
  API_ORIGIN: process.env.NEXT_PUBLIC_API_ORIGIN,
  INDEXER_ORIGIN: process.env.NEXT_PUBLIC_INDEXER_ORIGIN,
});
