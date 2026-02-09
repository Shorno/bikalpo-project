
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { user } from "../schema/auth-schema";
import { eq } from "drizzle-orm";

const connectionString = "postgres://postgres:VnAofnw2a8PZOI6VDKK23eMrWYYSSMh9Ozz4BvVDf6H6UP0MfPhetDnShOdEphJ9@72.62.74.96:2222/postgres";
const pool = new Pool({ connectionString });
const db = drizzle(pool, { schema: { user } });

async function main() {
    console.log("Searching for admin users...");
    const admins = await db.select().from(user).where(eq(user.role, "admin"));

    if (admins.length > 0) {
        console.log("Found admins:");
        admins.forEach(a => console.log(`- ${a.email} (${a.name})`));
    } else {
        console.log("No admin users found.");
    }
    process.exit(0);
}

main().catch(console.error);
