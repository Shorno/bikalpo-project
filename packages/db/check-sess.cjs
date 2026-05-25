const { Pool } = require("pg");
const pool = new Pool({ connectionString: "postgres://postgres:VnAofnw2a8PZOI6VDKK23eMrWYYSSMh9Ozz4BvVDf6H6UP0MfPhetDnShOdEphJ9@72.62.74.96:2222/postgres" });
pool.query(`
  SELECT s.id, s.user_id, s.expires_at, u.name, u.role
  FROM "session" s
  JOIN "user" u ON s.user_id = u.id
  WHERE u.phone_number LIKE '%1741151827%'
  ORDER BY s.expires_at DESC
  LIMIT 5
`).then(r => { console.table(r.rows); pool.end(); }).catch(e => { console.error(e); pool.end(); });
