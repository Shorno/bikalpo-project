import pg from 'pg';
const { Client } = pg;
const client = new Client({
  connectionString: 'postgres://postgres:VnAofnw2a8PZOI6VDKK23eMrWYYSSMh9Ozz4BvVDf6H6UP0MfPhetDnShOdEphJ9@72.62.74.96:2222/postgres'
});
await client.connect();
const r = await client.query('SELECT id, name, unit_size FROM product WHERE id = 17');
console.log(JSON.stringify(r.rows, null, 2));
await client.end();
