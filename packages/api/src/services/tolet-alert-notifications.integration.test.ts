import assert from "node:assert/strict";
import test from "node:test";
import { drizzle } from "drizzle-orm/node-postgres";
import { createRequire } from "node:module";

// Opt-in: all fixtures are connection-local TEMP tables and are rolled back.
test("notification discovery uses three conditions, respects visibility/ownership and deduplicates", { skip: process.env.TOLET_ALERT_DB_TEST !== "1" }, async () => {
  const { syncToLetAlertNotifications } = await import("./tolet-alert-notifications");
  const { Pool } = createRequire(import.meta.resolve("@bikalpo-project/db"))("pg") as typeof import("pg");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const table of ["tolet_rental_alert", "tolet_property", "tolet_unit", "tolet_unit_listing"]) {
      await client.query(`CREATE TEMP TABLE "${table}" ON COMMIT DROP AS SELECT * FROM public."${table}" WITH NO DATA`);
    }
    await client.query(`CREATE TEMP TABLE tolet_alert_notification (id text, user_id text, listing_id text, created_at timestamp default now(), read_at timestamp, UNIQUE(user_id, listing_id)) ON COMMIT DROP`);
    await client.query(`INSERT INTO tolet_rental_alert (id,user_id,status,preferred_category,preferred_location,minimum_size_sq_ft,minimum_bedrooms,minimum_bathrooms,minimum_balconies,preferred_floor) VALUES
      ('a','reader','active','family_flat','Dhaka, Mohammadpur',850,99,99,99,'99'),
      ('a2','reader','active','family_flat','Mohammadpur',850,0,0,0,'any'),
      ('paused','paused-reader','paused','any','Any location',0,0,0,0,'any')`);
    await client.query(`INSERT INTO tolet_property (id,owner_user_id,status,area,district,division,full_address) VALUES
      ('p','owner','active','Mohammadpur','Dhaka','Dhaka','Road 1'),
      ('own','reader','active','Mohammadpur','Dhaka','Dhaka','Road 1'),
      ('blocked','owner','blocked','Mohammadpur','Dhaka','Dhaka','Road 1'),
      ('elsewhere','owner','active','Mirpur','Dhaka','Dhaka','Road 2')`);
    for (const [id, property, type, size, status, visibility, listingStatus, days] of [
      ['match','p','family_flat',850,'vacant','public','active',1],
      ['larger','p','family_flat',900,'vacant','public','active',1],
      ['small','p','family_flat',849,'vacant','public','active',1],
      ['category','p','shop',900,'vacant','public','active',1],
      ['own','own','family_flat',900,'vacant','public','active',1],
      ['blocked','blocked','family_flat',900,'vacant','public','active',1],
      ['location','elsewhere','family_flat',900,'vacant','public','active',1],
      ['qr','p','family_flat',900,'vacant','qr_only','active',1],
      ['paused','p','family_flat',900,'vacant','public','paused',1],
      ['booked','p','family_flat',900,'booked','public','closed',1],
      ['expired','p','family_flat',900,'vacant','public','active',31],
    ]) {
      await client.query('INSERT INTO tolet_unit (id,property_id,unit_type,size_sq_ft,status) VALUES ($1,$2,$3,$4,$5)', [id,property,type,size,status]);
      await client.query(`INSERT INTO tolet_unit_listing (id,unit_id,status,visibility,published_at) VALUES ($1,$1,$2,$3,now() - $4::int * interval '1 day')`, [id,listingStatus,visibility,days]);
    }
    const database = drizzle(client);
    await syncToLetAlertNotifications('reader', database);
    assert.deepEqual((await client.query('SELECT listing_id FROM tolet_alert_notification ORDER BY listing_id')).rows.map(row => row.listing_id), ['larger','match']);
    await client.query("UPDATE tolet_alert_notification SET read_at=now() WHERE listing_id='match'");
    await syncToLetAlertNotifications('reader', database);
    assert.equal((await client.query('SELECT count(*)::int AS count FROM tolet_alert_notification')).rows[0].count, 2);
    assert.equal((await client.query('SELECT count(*)::int AS count FROM tolet_alert_notification WHERE read_at IS NULL')).rows[0].count, 1);
    await syncToLetAlertNotifications('paused-reader', database);
    assert.equal((await client.query("SELECT count(*)::int AS count FROM tolet_alert_notification WHERE user_id='paused-reader'")).rows[0].count, 0);
    await client.query("UPDATE tolet_rental_alert SET status='paused' WHERE user_id='reader'");
    await syncToLetAlertNotifications('reader', database);
    assert.equal((await client.query('SELECT count(*)::int AS count FROM tolet_alert_notification')).rows[0].count, 2);
  } finally {
    await client.query("ROLLBACK");
    client.release();
    await pool.end();
  }
});
