import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { drizzle } from "drizzle-orm/node-postgres";
import { saveToLetAlert } from "./tolet-saved-alerts";

test("Postgres saved alerts: isolation, quota, resume and real cross-connection lock", { skip: process.env.TOLET_ALERT_DB_TEST !== "1" }, async () => {
  const { Pool } = createRequire(import.meta.resolve("@bikalpo-project/db"))("pg") as typeof import("pg");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2, connectionTimeoutMillis: 10000 });
  const first = await pool.connect();
  const second = await pool.connect();
  const user = `alert-test-${crypto.randomUUID()}`;
  const fields = { preferredCategory: "family_flat", preferredLocation: "Dhaka", minimumSizeSqFt: 850, minimumBedrooms: 0, minimumBathrooms: 0, minimumBalconies: 0, balconyPreference: "optional", preferredFloor: "any" };
  try {
    await first.query("BEGIN ISOLATION LEVEL READ COMMITTED");
    await second.query("BEGIN");
    await first.query("SET LOCAL statement_timeout = '10s'");
    await second.query("SET LOCAL statement_timeout = '10s'");
    // LIKE does not copy foreign keys. No records copied and all writes resolve
    // to this connection-local TEMP table, never the application's table.
    await first.query("CREATE TEMP TABLE tolet_rental_alert (LIKE public.tolet_rental_alert INCLUDING ALL) ON COMMIT DROP");
    assert.equal((await first.query("SELECT relnamespace = pg_my_temp_schema() AS isolated FROM pg_class WHERE oid = 'tolet_rental_alert'::regclass")).rows[0].isolated, true);
    const tx = drizzle(first);
    const saved = await saveToLetAlert(tx, user, fields);
    assert.equal((await saveToLetAlert(tx, user, fields)).id, saved.id);
    const sameUserLock = await second.query("SELECT pg_try_advisory_xact_lock(hashtextextended($1, 0)) AS acquired", [`tolet-alerts:${user}`]);
    assert.equal(sameUserLock.rows[0].acquired, false);
    assert.equal((await second.query("SELECT pg_try_advisory_xact_lock(hashtextextended($1, 0)) AS acquired", [`tolet-alerts:${user}-other`])).rows[0].acquired, true);
    await first.query("UPDATE tolet_rental_alert SET status='paused' WHERE id=$1", [saved.id]);
    assert.equal((await saveToLetAlert(tx, user, fields)).status, "active");
    // Fill only the isolated table; no production consumers/properties needed.
    await first.query("INSERT INTO tolet_rental_alert (id,user_id,preferred_category,preferred_location) SELECT 'seed-' || n,$1,'any','Area ' || n FROM generate_series(1,49) n", [user]);
    await assert.rejects(saveToLetAlert(tx, user, { ...fields, preferredLocation: "New location" }), /50 saved/);
    assert.equal((await saveToLetAlert(tx, user, fields)).id, saved.id);
    assert.equal((await saveToLetAlert(tx, `${user}-second`, fields)).userId, `${user}-second`);
    assert.equal((await first.query("SELECT count(*)::int AS total FROM tolet_rental_alert WHERE user_id=$1", [user])).rows[0].total, 50);
  } finally {
    await Promise.all([first.query("ROLLBACK"), second.query("ROLLBACK")]);
    first.release(); second.release(); await pool.end();
  }
});
