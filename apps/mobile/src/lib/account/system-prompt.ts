/**
 * Whether the app itself has a system sheet up (the passkey chooser, Face ID). iOS reports the app as `inactive`
 * under those sheets exactly as it does in the app switcher, so the privacy plate needs to tell them apart: it must
 * cover the app-switcher snapshot, and must not black out the screen behind a prompt the user just asked for.
 */
let depth = 0;

export function systemPromptUp(): boolean {
  return depth > 0;
}

/** Wraps a platform object so every call counts as a prompt in flight until its promise settles. */
export function countingPrompts<T extends object>(target: T): T {
  return new Proxy(target, {
    get(obj, key, receiver) {
      const value = Reflect.get(obj, key, receiver) as unknown;
      if (typeof value !== "function") return value;
      return (...args: unknown[]) => {
        depth += 1;
        let settled = false;
        const done = () => {
          if (!settled) depth -= 1;
          settled = true;
        };
        try {
          const out = Reflect.apply(value, obj, args) as unknown;
          if (out instanceof Promise) return out.finally(done);
          done();
          return out;
        } catch (error) {
          done();
          throw error;
        }
      };
    },
  });
}
