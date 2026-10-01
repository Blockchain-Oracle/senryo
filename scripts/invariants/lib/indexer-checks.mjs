/**
 * D-173: indexer rows exist once per chain (`disable_default_cross_chain`, composite (id, chainId) key), so ids are never
 * namespaced and every reader must say which chain it means. A query that forgets risks mixing Practice and Mainnet
 * rows on one screen. `IndexerClient.request` only takes `defineDocument` results, so checking those covers every
 * GraphQL read in the repo.
 */
import { finding } from "./report.mjs";
import { readText, walkFiles } from "./walk.mjs";

const CODE_SCOPES = ["apps", "packages", "services", "scripts"];
const DOCUMENT = /defineDocument<([\s\S]+?)>\(\)\(\s*"(\w+)",\s*`([\s\S]*?)`/g;
const INLINE_CHAIN = /\bchainId:\s*\{\s*_eq:\s*\$\w+\s*\}/;
const BY_PK_CHAIN = /(^|[\s,])chainId:\s*\$\w+/;
const WHERE_VARIABLE = /\bwhere:\s*\$\w+/;
/** `_meta` answers one status row per chain with its `chainId`; callers pick theirs (`isIndexed`). */
const PER_CHAIN_ROWS = new Set(["_meta"]);

/** Index just past the bracket that closes the one at `start`. */
function closing(text, start, open, close) {
  let depth = 0;
  for (let i = start; i < text.length; i += 1) {
    if (text[i] === open) depth += 1;
    else if (text[i] === close) {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  return text.length;
}

/** The operation's top-level selections with their argument text (aliases resolved to the field). */
function rootFields(query) {
  const fields = [];
  const body = query.indexOf("{");
  if (body < 0) return fields;
  let i = body + 1;
  let depth = 1;
  while (i < query.length && depth > 0) {
    const c = query[i];
    if (c === "{") depth += 1;
    else if (c === "}") depth -= 1;
    else if (c === "(" && depth === 1) {
      const end = closing(query, i, "(", ")");
      if (fields.length > 0) fields[fields.length - 1].args = query.slice(i + 1, end - 1);
      i = end;
      continue;
    } else if (depth === 1 && /[A-Za-z_]/.test(c)) {
      const name = /^\w+/.exec(query.slice(i))[0];
      i += name.length;
      if (!/^\s*:/.test(query.slice(i))) fields.push({ name, args: "" });
      continue;
    }
    i += 1;
  }
  return fields;
}

/** Type names in `source` that are `ChainWhere` (the type itself or a local alias of it). */
function chainWhereNames(source) {
  const names = new Set(["ChainWhere"]);
  for (const m of source.matchAll(/\btype\s+(\w+)\s*=\s*ChainWhere\s*;/g)) names.add(m[1]);
  return names;
}

/** The declared type of `where` in a document's variables type (inline object, interface or type alias). */
function whereType(source, varsType) {
  const named = /^\w+$/.test(varsType.trim())
    ? new RegExp(`(?:interface\\s+${varsType.trim()}\\s*|type\\s+${varsType.trim()}\\s*=\\s*)\\{([^}]*)\\}`).exec(
        source,
      )
    : null;
  const body = named ? named[1] : varsType;
  return /\bwhere\??:\s*(\w+)/.exec(body)?.[1];
}

export function indexerDocsChainFilter(rule, ctx) {
  const findings = [];
  let documents = 0;
  for (const scope of CODE_SCOPES) {
    for (const { rel, abs } of walkFiles(ctx.root, scope, [".ts", ".tsx"])) {
      const source = readText(abs);
      if (!source.includes("defineDocument<")) continue;
      const chainWheres = chainWhereNames(source);
      for (const [, varsType, name, query] of source.matchAll(DOCUMENT)) {
        documents += 1;
        for (const field of rootFields(query)) {
          if (PER_CHAIN_ROWS.has(field.name)) continue;
          if (INLINE_CHAIN.test(field.args) || BY_PK_CHAIN.test(field.args)) continue;
          if (WHERE_VARIABLE.test(field.args)) {
            const declared = whereType(source, varsType);
            if (declared && chainWheres.has(declared)) continue;
            findings.push(
              finding(rule, `${name}.${field.name}: $where must be typed ChainWhere (got ${declared ?? "?"})`, rel),
            );
            continue;
          }
          findings.push(finding(rule, `${name}.${field.name} has no chainId: { _eq: $… } filter`, rel));
        }
      }
    }
  }
  return documents === 0 ? { findings, skipped: "no indexer documents" } : { findings };
}
