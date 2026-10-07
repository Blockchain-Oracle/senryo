/** Explicit opt-in AND a development bundle. Release builds cannot enable the workspace. */
export const DEV_WORKSPACE = __DEV__ && process.env.EXPO_PUBLIC_DEV_WORKSPACE === "1";

/** Host-side fork controller; never a public RPC or production API. */
export const DEV_ORIGIN = "http://127.0.0.1:18766";
export const DEV_RPC_TIMEOUT_MS = 30_000;
export const DEV_RPC = "http://127.0.0.1:18765";

export function requireDevWorkspace(): void {
  if (!DEV_WORKSPACE) throw new Error("Development workspace is disabled");
}

export async function devControl(action: string, body: object = {}): Promise<void> {
  requireDevWorkspace();
  const response = await fetch(`${DEV_ORIGIN}/${action}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await response.text());
}
