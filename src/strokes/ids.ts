/**
 * Unique-enough ids: a per-session prefix plus a counter.
 * Not crypto.randomUUID(): it needs a secure context, and http://192.168.x.x isn't one.
 */
export function createIdGenerator(): () => string {
  const prefix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  let counter = 0;
  return () => {
    counter += 1;
    return `${prefix}-${counter}`;
  };
}