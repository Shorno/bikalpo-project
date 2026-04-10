import { Pool } from "pg";
import * as dotenv from "dotenv";
import * as path from "path";
import { randomUUID } from "crypto";

dotenv.config({ path: path.resolve(__dirname, "../../apps/server/.env") });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not found in .env");
  process.exit(1);
}

async function createDeliveryman() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    const existing = await pool.query(
      `SELECT id, name, phone_number, role FROM "user" WHERE role = 'deliveryman' LIMIT 5`
    );

    if (existing.rows.length > 0) {
      console.log("Existing deliverymen found:");
      existing.rows.forEach((r: any) =>
        console.log(`  - ${r.name} (${r.phone_number}) [${r.id}]`)
      );
      return;
    }

    const id = randomUUID();
    const now = new Date().toISOString();

    await pool.query(
      `INSERT INTO "user" (id, name, email, phone_number, role, service_area, email_verified, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        id,
        "Delivery Man 1",
        "deliveryman1@bikalpo.com",
        "01700000001",
        "deliveryman",
        "Feni, Dhaka",
        true,
        now,
        now,
      ]
    );

    console.log("✅ Deliveryman created:");
    console.log(`   Name: Delivery Man 1`);
    console.log(`   Phone: 01700000001`);
    console.log(`   ID: ${id}`);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await pool.end();
  }
}

createDeliveryman();
