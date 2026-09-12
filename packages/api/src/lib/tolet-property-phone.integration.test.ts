import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { drizzle } from "drizzle-orm/node-postgres";

// Opt-in: all writes target a connection-local TEMP verification table; no account or property is written.
test("property OTP attempts persist, proof is one-use and rollback-safe", { skip: process.env.TOLET_PROPERTY_PHONE_DB_TEST !== "1" }, async () => {
  const { requestPropertyPhoneCode, verifyPropertyPhoneCode, consumePropertyPhoneProof } = await import("./tolet-property-phone");
  const { Pool } = createRequire(import.meta.resolve("@bikalpo-project/db"))("pg") as typeof import("pg");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  const connection = await pool.connect();
  try {
    await connection.query("CREATE TEMP TABLE verification (id text PRIMARY KEY, identifier text NOT NULL, value text NOT NULL, expires_at timestamp NOT NULL, created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now())");
    const database = drizzle(connection) as unknown as NonNullable<Parameters<typeof requestPropertyPhoneCode>[2]>;
    const sent = await requestPropertyPhoneCode("owner-test", "01712345678", database);
    assert.equal(sent.phone, "+8801712345678");
    await assert.rejects(requestPropertyPhoneCode("owner-test", "01812345678", database), /Wait 60 seconds/);
    await assert.rejects(verifyPropertyPhoneCode("another-owner", sent.phone, sent.developmentCode, database));
    const wrongCode = sent.developmentCode === "000000" ? "999999" : "000000";
    await assert.rejects(verifyPropertyPhoneCode("owner-test", sent.phone, wrongCode, database), /Incorrect/);
    assert.equal(JSON.parse((await connection.query("SELECT value FROM verification")).rows[0].value).attempts, 1);
    const proof = await verifyPropertyPhoneCode("owner-test", "8801712345678", sent.developmentCode, database);
    await assert.rejects(database.transaction(async tx => {
      await consumePropertyPhoneProof(tx, "owner-test", sent.phone, proof.proof);
      throw new Error("Simulated property write failed");
    }), /Simulated property/);
    // Rolled-back write must leave the proof valid for a retry.
    const verifiedAt = await database.transaction(tx => consumePropertyPhoneProof(tx, "owner-test", sent.phone, proof.proof));
    assert.ok(verifiedAt instanceof Date);
    await assert.rejects(database.transaction(tx => consumePropertyPhoneProof(tx, "owner-test", sent.phone, proof.proof)), /Verify this property/);
    await assert.rejects(verifyPropertyPhoneCode("owner-test", sent.phone, sent.developmentCode, database), /expired or was already used/);
  } finally {
    connection.release();
    await pool.end();
  }
});
