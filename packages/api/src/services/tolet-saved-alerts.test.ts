import assert from "node:assert/strict";
import test from "node:test";
import { saveToLetAlert } from "./tolet-saved-alerts";

const input = { preferredCategory: "family_flat", preferredLocation: "Dhaka", minimumSizeSqFt: 850, minimumBedrooms: 0, minimumBathrooms: 0, minimumBalconies: 0, balconyPreference: "optional", preferredFloor: "any" };
type Row = typeof input & { id: string; userId: string; status: string };

// In-memory transactional adapter: no business DB connection. execute emulates
// a per-user xact lock; assertions require the lock before any reads/writes.
function harness(initial: Row[] = []) {
  const rows = [...initial];
  const locks = new Map<string, Promise<void>>();
  const run = async (userId: string, fields = input) => {
    let locked = false;
    let release: (() => void) | undefined;
    const check = () => assert.equal(locked, true, "queries must follow the transaction lock");
    const tx = {
      async execute() {
        const previous = locks.get(userId) ?? Promise.resolve();
        const current = new Promise<void>(resolve => { release = resolve; });
        locks.set(userId, current);
        await previous;
        locked = true;
      },
      select(projection?: unknown) {
        check();
        return { from: () => ({ where: () => projection
          ? Promise.resolve([{ value: rows.filter(r => r.userId === userId).length }])
          : { limit: async () => rows.filter(r => r.userId === userId && r.status !== "fulfilled" && Object.entries(fields).every(([key, value]) => r[key as keyof Row] === value)).slice(0, 1) }
        }) };
      },
      update() {
        check();
        return { set: (value: { status: string }) => ({ where: () => ({ returning: async () => {
          const row = rows.find(r => r.userId === userId && r.preferredLocation === fields.preferredLocation);
          if (row) row.status = value.status;
          return row ? [row] : [];
        } }) }) };
      },
      insert() {
        check();
        return { values: (value: Row) => ({ returning: async () => {
          const row = { ...value, id: String(rows.length + 1), status: "active" };
          rows.push(row); return [row];
        } }) };
      },
    };
    try { return await saveToLetAlert(tx as unknown as Parameters<typeof saveToLetAlert>[0], userId, fields); }
    finally { release?.(); }
  };
  return { run, rows };
}

test("concurrent identical creates return one saved alert", async () => {
  const store = harness();
  const results = await Promise.all(Array.from({ length: 12 }, () => store.run("alice")));
  assert.equal(store.rows.length, 1);
  assert.equal(new Set(results.map(r => r.id)).size, 1);
});

test("concurrent unique creates cannot exceed the 50-alert limit", async () => {
  const store = harness(Array.from({ length: 49 }, (_, i) => ({ ...input, id: `seed-${i}`, preferredLocation: `Area ${i}`, userId: "alice", status: "active" })));
  const results = await Promise.allSettled(Array.from({ length: 8 }, (_, i) => store.run("alice", { ...input, preferredLocation: `New ${i}` })));
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  assert.equal(store.rows.length, 50);
  for (const result of results) if (result.status === "rejected") assert.match(String(result.reason), /50 saved/);
  await store.run("bob");
  assert.equal(store.rows.filter(r => r.userId === "bob").length, 1);
});

test("duplicate at quota resumes a paused alert without consuming a slot", async () => {
  const store = harness(Array.from({ length: 50 }, (_, i) => ({ ...input, id: `seed-${i}`, preferredLocation: i ? `Area ${i}` : "Dhaka", userId: "alice", status: i ? "active" : "paused" })));
  const result = await store.run("alice");
  assert.equal(result.id, "seed-0");
  assert.equal(result.status, "active");
  assert.equal(store.rows.length, 50);
});
