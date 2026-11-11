/** Minimal browser state for pure request/session tests, without mounting UI components. */
export function browserFixture() {
  const data = new Map<string, string>();
  return Object.assign(new EventTarget(), {
    location: { href: "https://app.test/", origin: "https://app.test" },
    localStorage: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => { data.set(key, value); },
      removeItem: (key: string) => { data.delete(key); }
    }
  });
}
