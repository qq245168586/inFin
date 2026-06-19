import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createMockDatabaseState } from "../fixtures/mock-db.ts";

type TestContext = {
  after: (fn: () => void | Promise<void>) => void;
  name: string;
};

export function createIsolatedDataRoot(prefix: string, state = createMockDatabaseState()) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `infini-server-${prefix}-`));
  fs.mkdirSync(path.join(root, "media"), { recursive: true });
  fs.mkdirSync(path.join(root, "app-packages"), { recursive: true });
  fs.mkdirSync(path.join(root, "backups"), { recursive: true });
  fs.writeFileSync(path.join(root, "db.json"), `${JSON.stringify(state, null, 2)}\n`, "utf8");
  return root;
}

export async function importStore(t: TestContext, state = createMockDatabaseState()) {
  const previousDataRoot = process.env.INFINI_DATA_ROOT;
  const root = createIsolatedDataRoot(sanitizeName(t.name), state);
  process.env.INFINI_DATA_ROOT = root;
  t.after(() => {
    if (previousDataRoot === undefined) {
      delete process.env.INFINI_DATA_ROOT;
    } else {
      process.env.INFINI_DATA_ROOT = previousDataRoot;
    }
    fs.rmSync(root, { recursive: true, force: true });
  });

  const cacheBust = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return import(`../../src/data/store.ts?test=${cacheBust}`);
}

export function nextMonday(offsetWeeks = 0) {
  const now = new Date();
  const monday = new Date(now);
  monday.setHours(12, 0, 0, 0);
  const day = monday.getDay();
  const delta = day === 0 ? -6 : 1 - day;
  monday.setDate(monday.getDate() + delta + offsetWeeks * 7);
  return formatShanghaiDate(monday);
}

export function addDays(dateText: string, days: number) {
  const date = new Date(`${dateText}T12:00:00.000+08:00`);
  date.setUTCDate(date.getUTCDate() + days);
  return formatShanghaiDate(date);
}

export function shanghaiNoon(dateText: string) {
  return new Date(`${dateText}T12:00:00.000+08:00`).toISOString();
}

function formatShanghaiDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function sanitizeName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "test";
}
