import { Pool } from "pg";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../apps/server/.env") });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not found in .env");
  process.exit(1);
}

async function fixDeliverymanRole() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    // Find the user with phone number 01700000001 who is currently a consumer
    const result = await pool.query(
      `SELECT id, name, email, phone_number, role FROM "user" WHERE phone_number LIKE '%01700000001%' ORDER BY created_at DESC`
    );

    console.log("Users with phone 01700000001:");
    result.rows.forEach((r: any) =>
      console.log(`  [${r.role}] ${r.name} (${r.email}) - ID: ${r.id}`)
    );

    // Update the consumer one to deliveryman
    const consumerUser = result.rows.find((r: any) => r.role === "consumer");
    if (consumerUser) {
      await pool.query(
        `UPDATE "user" SET role = 'deliveryman', service_area = 'Feni, Dhaka' WHERE id = $1`,
        [consumerUser.id]
      );
      console.log(`\n✅ Updated ${consumerUser.name} (${consumerUser.id}) → role: deliveryman`);
    } else {
      console.log("\nNo consumer user found with that phone. Checking all users...");
      const all = await pool.query(
        `SELECT id, name, email, phone_number, role FROM "user" WHERE email LIKE '%01700000001%' OR phone_number LIKE '%01700000001%'`
      );
      all.rows.forEach((r: any) =>
        console.log(`  [${r.role}] ${r.name} (${r.email}) - ID: ${r.id}`)
      );
    }

    // Also delete the duplicate deliveryman entry we created via script
    const dupeDeliveryman = result.rows.find(
      (r: any) => r.role === "deliveryman" && r.email === "deliveryman1@bikalpo.com"
    );
    if (dupeDeliveryman) {
      await pool.query(`DELETE FROM "user" WHERE id = $1`, [dupeDeliveryman.id]);
      console.log(`🗑️  Removed duplicate script-created entry: ${dupeDeliveryman.id}`);
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await pool.end();
  }
}

fixDeliverymanRole();
