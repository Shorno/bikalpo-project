
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../schema";
import { user } from "../schema/auth-schema";
import { eq } from "drizzle-orm";

const connectionString = "postgres://postgres:VnAofnw2a8PZOI6VDKK23eMrWYYSSMh9Ozz4BvVDf6H6UP0MfPhetDnShOdEphJ9@72.62.74.96:2222/postgres";
const pool = new Pool({ connectionString });
const db = drizzle(pool, { schema });

async function main() {
    const email = "iftakharrahat73@gmail.com";

    console.log(`Checking for user: ${email}`);

    const foundUser = await db.query.user.findFirst({
        where: eq(user.email, email),
    });

    if (foundUser) {
        console.log("User found:");
        console.log(JSON.stringify(foundUser, null, 2));
    } else {
        console.log("User NOT found.");

        // Create user if not found?
        // Or wait for instruction.
    }

    process.exit(0);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
