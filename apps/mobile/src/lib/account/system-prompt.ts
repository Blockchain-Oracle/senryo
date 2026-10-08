/**
 * Whether the app itself has a system sheet up (the passkey chooser, Face ID). iOS reports the app as `inactive`
 * under those sheets exactly as it does in the app switcher, so the privacy plate needs to tell them apart: it must
 * cover the app-switcher snapshot, and must not black out the screen behind a prompt the user just asked for.
 */
let depth = 0;

export function systemPromptUp(): boolean {
  return depth > 0;
}

export interface PromptOptions {
  /** Methods that raise an OS sheet: their success waits for `settle` (iOS resolves them before `active` returns). */
  raises?: ReadonlySet<PropertyKey>;
  settle?: () => Promise<void>;
}

/** Wraps a platform object so every call counts as a prompt in flight until its promise settles. */
export function countingPrompts<T extends object>(target: T, options: PromptOptions = {}): T {
  return new Proxy(target, {
    get(obj, key, receiver) {
      const value = Reflect.get(obj, key, receiver) as unknown;
      if (typeof value !== "function") return value;
      const settle = options.settle && options.raises?.has(key) ? options.settle : undefined;
      return (...args: unknown[]) => {
        depth += 1;
        let settled = false;
        const done = () => {
          if (!settled) depth -= 1;
          settled = true;
        };
        try {
          const out = Reflect.apply(value, obj, args) as unknown;
          if (!(out instanceof Promise)) {
            done();
            return out;
          }
          // A sheet that answered keeps counting until the app is foreground again, so nothing signs while inactive.
          const answered = settle
            ? out.then(async (result: unknown) => {
                await settle();
                return result;
              })
            : out;
          return answered.finally(done);
        } catch (error) {
          done();
          throw error;
        }
      };
    },
  });
}
