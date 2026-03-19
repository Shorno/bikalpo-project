import pg from "pg";
const { Client } = pg;

const c = new Client("postgres://postgres:VnAofnw2a8PZOI6VDKK23eMrWYYSSMh9Ozz4BvVDf6H6UP0MfPhetDnShOdEphJ9@72.62.74.96:2222/postgres");

await c.connect();
await c.query(`
  CREATE TABLE IF NOT EXISTS landing_pricing_plan (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    subtitle TEXT,
    price_monthly INTEGER NOT NULL,
    price_yearly INTEGER,
    features JSON DEFAULT '[]',
    is_popular BOOLEAN DEFAULT false,
    cta_text TEXT DEFAULT 'Choose Plan',
    sort_order INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
  );
`);
console.log("Table created successfully");
await c.end();
