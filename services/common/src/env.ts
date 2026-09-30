import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { type ChainId, isChainId } from "@senryo/config";
import { z } from "zod";

/**
 * Service env parsing. Each service owns its schema (S3.1 note: service env lives with the service). Secrets come
 * from `NAME` (Coolify runtime env, Build off) or `NAME_FILE` (a path, e.g. `~/.config/senryo/testnet-keeper.key`
 * locally); values are never logged — errors name the variable only.
 */

export class EnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvError";
  }
}

export function parseEnv<S extends z.ZodType>(schema: S, source: NodeJS.ProcessEnv = process.env): z.output<S> {
  const result = schema.safeParse(source);
  if (result.success) return result.data;
  const names = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
  throw new EnvError(`invalid environment — ${names.join("; ")}`);
}

function expandHome(path: string): string {
  return path.startsWith("~/") ? `${homedir()}${path.slice(1)}` : path;
}

/** Secret value from `NAME` or the file at `NAME_FILE`; undefined when neither is set. */
export function readSecret(name: string, source: NodeJS.ProcessEnv = process.env): string | undefined {
  const direct = source[name];
  if (direct && direct.trim() !== "") return direct.trim();
  const file = source[`${name}_FILE`];
  if (!file) return undefined;
  try {
    return readFileSync(expandHome(file), "utf8").trim();
  } catch {
    throw new EnvError(`${name}_FILE: cannot read the file`);
  }
}

export function requireSecret(name: string, source: NodeJS.ProcessEnv = process.env): string {
  const value = readSecret(name, source);
  if (!value) throw new EnvError(`${name} (or ${name}_FILE) is required`);
  return value;
}

/** Comma-separated list (RPC overrides); empty → undefined. */
export const csvSchema = z
  .string()
  .optional()
  .transform((text) =>
    text
      ?.split(",")
      .map((part) => part.trim())
      .filter(Boolean),
  );

export const chainIdEnvSchema = z.coerce
  .number()
  .int()
  .refine((value) => isChainId(value), "must be the mainnet or testnet chain id")
  .transform((value) => value as ChainId);

const MAX_PORT = 65_535;
export const portSchema = z.coerce.number().int().min(1).max(MAX_PORT);

/** Common to all three services. */
export const baseEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z.url(),
  CHAIN_ID: chainIdEnvSchema,
  RPC_HTTP: csvSchema,
  RPC_WS: csvSchema,
});
