import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { drizzle } from "drizzle-orm/node-postgres";
import { getOwnedUnitRentalHistory } from "./tolet-owner-rental-history";

test("Postgres owner history reads prior/current tenants and denies tenant/other-owner access", { skip: process.env.TOLET_RENTAL_DB_TEST !== "1", timeout: 30000 }, async () => {
	const { Pool } = createRequire(import.meta.resolve("@bikalpo-project/db"))("pg") as typeof import("pg");
	const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 10000 });
	const connection = await pool.connect();
	try {
		await connection.query("BEGIN ISOLATION LEVEL READ COMMITTED");
		await connection.query("SET LOCAL statement_timeout = '10s'");
		for (const table of ["tolet_property", "tolet_unit", "tolet_booking_request", "tolet_rental_contract", "tolet_rent_payment"]) {
			await connection.query(`CREATE TEMP TABLE ${table} (LIKE public.${table} INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES) ON COMMIT DROP`);
			assert.equal((await connection.query("SELECT relnamespace = pg_my_temp_schema() AS isolated FROM pg_class WHERE oid = $1::regclass", [table])).rows[0].isolated, true);
		}
		await connection.query(`INSERT INTO tolet_property (id, public_number, owner_user_id, qr_token, name, cover_image_url, owner_name, mobile_number, property_type, division, district, area, full_address, building_type, total_floors, declared_total_units, front_image_url, phone_verified_at, information_confirmed_at, terms_accepted_at, property_policy_accepted_at, created_at)
			VALUES ('history-property', 100001, 'history-owner', 'test-token', 'Test property', 'test-image', 'Test owner', 'test-phone', 'apartment', 'Dhaka', 'Dhaka', 'Mirpur', 'Test address', 'residential', 1, 1, 'test-image', now(), now(), now(), now(), '2026-01-01')`);
		await connection.query("INSERT INTO tolet_unit (id, public_number, property_id, name, unit_type, floor_number, size_sq_ft, status) VALUES ('history-unit', 100001, 'history-property', 'Test unit', 'family_flat', 1, 850, 'occupied')");
		for (const [number, name] of [[200001, "Previous tenant"], [200002, "Current tenant"], [200003, "Different owner private tenant"]] as const) {
			await connection.query(`INSERT INTO tolet_booking_request (id, public_number, listing_id, requester_user_id, contact_name, contact_phone, desired_move_in_date, idempotency_key, offer_snapshot, listing_updated_at_at_request, status, responded_at)
				VALUES ($1::text, $2, $3, $4, $5, 'test-phone', '2026-06-01', $1::text, '{}', now(), 'accepted', now())`, [`booking-${number}`, number, `listing-${number}`, `tenant-${number}`, name]);
		}
		await connection.query(`INSERT INTO tolet_rental_contract (id, public_number, booking_request_id, property_id, unit_id, owner_user_id, tenant_user_id, start_date, end_date, monthly_rent, status) VALUES
			('history-old', 300001, 'booking-200001', 'history-property', 'history-unit', 'history-owner', 'tenant-200001', '2026-06-01', '2026-06-30', 15000, 'completed'),
			('history-current', 300002, 'booking-200002', 'history-property', 'history-unit', 'history-owner', 'tenant-200002', '2026-08-01', '2026-12-31', 18000, 'active'),
			('history-foreign', 300003, 'booking-200003', 'history-property', 'history-unit', 'different-owner', 'tenant-200003', '2026-07-01', '2026-07-31', 19000, 'completed')`);
		await connection.query("INSERT INTO tolet_rent_payment (id, contract_id, cycle_month, due_date, amount, status, reference_name, verified_at) VALUES ('history-payment', 'history-old', '2026-06-01', '2026-06-01', 15000, 'paid', 'Test manager', '2026-06-05')");
		const store = drizzle(connection);
		const input = { propertyCode: "PR-2026-100001", unitCode: "UNT-100001", page: 1 };
		const now = new Date("2026-09-12T10:00:00Z");
		const result = await getOwnedUnitRentalHistory(store, "history-owner", input, "test-only-history-secret", now);
		assert.deepEqual(result.rows.map(row => row.tenantName), ["Previous tenant", "Vacant", "Current tenant", "Current tenant"]);
		assert.equal(result.rows[0]?.tenantId, "tenant-200001");
		assert.equal(result.rows[0]?.referenceName, "Test manager");
		assert.equal(result.rows[0]?.status, "paid");
		assert.equal(result.rows[1]?.amount, null);
		assert.equal(result.rows[3]?.amount, 18000);
		assert.match(result.rows[3]?.otp ?? "", /^\d{6}$/);
		assert.equal(JSON.stringify(result).includes("Different owner private tenant"), false);
		for (const account of ["tenant-200001", "tenant-200002", "different-owner", "stranger"]) await assert.rejects(getOwnedUnitRentalHistory(store, account, input, "test-only-history-secret", now), /Unit not found/);
		await assert.rejects(getOwnedUnitRentalHistory(store, "history-owner", { ...input, propertyCode: "PR-2025-100001" }, "test-only-history-secret", now), /Unit not found/);
		// This endpoint reads/derives missing monthly rows but never persists them.
		assert.equal((await connection.query("SELECT count(*)::int AS total FROM tolet_rent_payment")).rows[0].total, 1);
	} finally {
		await connection.query("ROLLBACK");
		connection.release();
		await pool.end();
	}
});
