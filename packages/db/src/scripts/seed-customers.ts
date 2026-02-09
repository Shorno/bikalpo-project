
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { user } from "../schema/auth-schema";
import { eq } from "drizzle-orm";

const connectionString = "postgres://postgres:VnAofnw2a8PZOI6VDKK23eMrWYYSSMh9Ozz4BvVDf6H6UP0MfPhetDnShOdEphJ9@72.62.74.96:2222/postgres";
const pool = new Pool({ connectionString });
const db = drizzle(pool, { schema: { user } });

async function main() {
    const customers = [
        { id: "cust_1", email: "customer1@example.com", name: "Modern Electronics", shopName: "Modern Electronics Ltd", role: "customer" },
        { id: "cust_2", email: "customer2@example.com", name: "Rahim Store", shopName: "Rahim General Store", role: "customer" },
        { id: "cust_3", email: "customer3@example.com", name: "Tech Hub", shopName: "Tech Hub Solutions", role: "customer" },
    ];

    console.log("Seeding test customers...");

    for (const c of customers) {
        // Check if exists
        const found = await db.select().from(user).where(eq(user.email, c.email));
        if (found.length === 0) {
            await db.insert(user).values({
                id: c.id,
                email: c.email,
                name: c.name,
                shopName: c.shopName,
                role: "customer",
            });
            console.log(`Created: ${c.email}`);
        } else {
            console.log(`Skipped (already exists): ${c.email}`);
        }
    }

    process.exit(0);
}

main().catch(console.error);
