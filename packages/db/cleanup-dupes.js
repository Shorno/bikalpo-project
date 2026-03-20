import pg from "pg";
const { Client } = pg;

const c = new Client("postgres://postgres:VnAofnw2a8PZOI6VDKK23eMrWYYSSMh9Ozz4BvVDf6H6UP0MfPhetDnShOdEphJ9@72.62.74.96:2222/postgres");
await c.connect();
await c.query('TRUNCATE "user" CASCADE');
console.log("User table truncated.");
await c.end();
