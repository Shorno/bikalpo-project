
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { user } from "../schema/auth-schema";
import { eq } from "drizzle-orm";

const connectionString = "postgres://postgres:VnAofnw2a8PZOI6VDKK23eMrWYYSSMh9Ozz4BvVDf6H6UP0MfPhetDnShOdEphJ9@72.62.74.96:2222/postgres";
const pool = new Pool({ connectionString });
const db = drizzle(pool, { schema: { user } });

async function main() {
    const email = "iftakharrahat73@gmail.com";
    const password = "bracU699:*3";
    const name = "Iftakhar Rahat";

    console.log(`Attempting to sign up user: ${email}`);

    // 1. Try to sign up via API
    try {
        const response = await fetch("http://localhost:3000/auth/sign-up/email", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                email,
                password,
                name,
            }),
        });

        if (response.ok) {
            console.log("Sign up successful via API.");
        } else {
            const text = await response.text();
            console.log(`Sign up API returned status ${response.status}: ${text}`);
            if (response.status === 400 || response.status === 422 || text.includes("exists")) {
                console.log("User might already exist. Proceeding to update role.");
            }
        }
    } catch (e) {
        console.error("Failed to call sign-up API:", e);
        console.log("Ensure backend server is running at http://localhost:3000");
    }

    // 2. Update role in Database
    console.log("Updating user role to 'salesman' in database...");

    // Check if user exists first
    const found = await db.select().from(user).where(eq(user.email, email));

    if (found.length === 0) {
        console.error("User not found in database even after sign-up attempt.");
        process.exit(1);
    }

    // Update role
    await db.update(user)
        .set({ role: "salesman" })
        .where(eq(user.email, email));

    console.log(`Successfully updated ${email} to role 'salesman'.`);
    process.exit(0);
}

main().catch(console.error);
