
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { user } from "../schema/auth-schema";
import { eq } from "drizzle-orm";

const connectionString = "postgres://postgres:VnAofnw2a8PZOI6VDKK23eMrWYYSSMh9Ozz4BvVDf6H6UP0MfPhetDnShOdEphJ9@72.62.74.96:2222/postgres";
const pool = new Pool({ connectionString });
const db = drizzle(pool, { schema: { user } });

async function main() {
    const email = "admin@bikalpo.com";
    const password = "password123";
    const name = "Admin User";

    console.log(`Attempting to sign up admin: ${email}`);

    try {
        const response = await fetch("http://localhost:3000/auth/sign-up/email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password, name }),
        });

        if (response.ok) console.log("Sign up successful via API.");
        else console.log(`Sign up API returned status ${response.status}`);
    } catch (e) {
        console.error("Failed to call sign-up API:", e);
    }

    // Update role
    const found = await db.select().from(user).where(eq(user.email, email));

    if (found.length > 0) {
        await db.update(user)
            .set({ role: "admin" })
            .where(eq(user.email, email));
        console.log(`Successfully updated ${email} to role 'admin'.`);
    } else {
        console.error("User not found in database.");
    }
    process.exit(0);
}

main().catch(console.error);
