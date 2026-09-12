import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { drizzle } from "drizzle-orm/node-postgres";
import { completeToLetRentalInTransaction } from "./tolet-rental-completion";
import { toLetRentOtp, verifyToLetRentPayment } from "./tolet-rent-payment";

test("Postgres rent safety: tenant isolation, OTP lockout/replay and fresh-contract completion", { skip: process.env.TOLET_RENTAL_DB_TEST !== "1", timeout: 30000 }, async () => {
	const { Pool } = createRequire(import.meta.resolve("@bikalpo-project/db"))("pg") as typeof import("pg");
	const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 10000 });
	const connection = await pool.connect();
	try {
		await connection.query("BEGIN ISOLATION LEVEL READ COMMITTED");
		await connection.query("SET LOCAL statement_timeout = '10s'");
		// No FK copies, no application rows, and no public identity-sequence calls.
		// All four targets MUST resolve to connection-private TEMP tables before writes.
		for (const table of ["tolet_unit", "tolet_rental_contract", "tolet_rent_payment", "verification"]) {
			await connection.query(`CREATE TEMP TABLE ${table} (LIKE public.${table} INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES) ON COMMIT DROP`);
			assert.equal((await connection.query("SELECT relnamespace = pg_my_temp_schema() AS isolated FROM pg_class WHERE oid = $1::regclass", [table])).rows[0].isolated, true);
		}
		await connection.query("INSERT INTO tolet_unit (id, public_number, property_id, name, unit_type, floor_number, size_sq_ft, status) VALUES ('test-unit', 1, 'test-property', 'Test unit', 'family_flat', 1, 850, 'occupied')");
		await connection.query("INSERT INTO tolet_rental_contract (id, public_number, booking_request_id, property_id, unit_id, owner_user_id, tenant_user_id, start_date, end_date, monthly_rent) VALUES ('test-contract', 1, 'test-booking', 'test-property', 'test-unit', 'test-owner', 'test-tenant', '2026-08-01', '2026-09-30', 15000)");
		await connection.query("INSERT INTO tolet_rent_payment (id, contract_id, cycle_month, due_date, amount) VALUES ('test-payment', 'test-contract', '2026-09-01', '2026-09-01', 15000)");
		const tx = drizzle(connection);
		const secret = "test-only-rent-otp-secret";
		const now = new Date("2026-09-12T10:00:00Z");
		const input = { contractId: "test-contract", tenantUserId: "test-tenant", cycleMonth: "2026-09-01", referenceName: "Test receiver", otp: toLetRentOtp("test-contract", "2026-09-01", secret) };
		assert.equal((await verifyToLetRentPayment(tx, { ...input, tenantUserId: "test-owner" }, secret, now)).status, "forbidden");
		assert.equal((await verifyToLetRentPayment(tx, { ...input, tenantUserId: "another-tenant" }, secret, now)).status, "forbidden");
		const wrong = input.otp === "000000" ? "111111" : "000000";
		for (let attempt = 0; attempt < 5; attempt++) assert.equal((await verifyToLetRentPayment(tx, { ...input, otp: wrong }, secret, now)).status, "incorrect");
		assert.equal((await verifyToLetRentPayment(tx, input, secret, now)).status, "rate_limited");
		assert.equal((await connection.query("SELECT status FROM tolet_rent_payment WHERE id='test-payment'")).rows[0].status, "pending");
		const afterCooldown = new Date(now.getTime() + 15 * 60 * 1000);
		assert.equal((await verifyToLetRentPayment(tx, input, secret, afterCooldown)).status, "paid");
		assert.equal((await verifyToLetRentPayment(tx, input, secret, afterCooldown)).status, "unavailable");
		assert.equal((await connection.query("SELECT count(*)::int AS total FROM verification")).rows[0].total, 0);
		const payment = (await connection.query("SELECT status, reference_name, verified_at FROM tolet_rent_payment WHERE id='test-payment'")).rows[0];
		assert.equal(payment.reference_name, input.referenceName);
		assert.equal(payment.status, "paid");
		assert.ok(payment.verified_at);

		// Caller thinks this contract expired; the locked database date is authoritative.
		assert.equal((await completeToLetRentalInTransaction(tx, input.contractId, "test-unit", now))?.status, "active");
		await connection.query("UPDATE tolet_rental_contract SET end_date='2026-09-11', status='leaving' WHERE id='test-contract'");
		assert.equal((await completeToLetRentalInTransaction(tx, input.contractId, "test-unit", now))?.status, "completed");
		assert.equal((await connection.query("SELECT status FROM tolet_unit WHERE id='test-unit'")).rows[0].status, "vacant");
		await connection.query("UPDATE tolet_unit SET status='occupied' WHERE id='test-unit'");
		await completeToLetRentalInTransaction(tx, input.contractId, "test-unit", now);
		assert.equal((await connection.query("SELECT status FROM tolet_unit WHERE id='test-unit'")).rows[0].status, "occupied");
	} finally {
		await connection.query("ROLLBACK");
		connection.release();
		await pool.end();
	}
});
