import { db } from "../../packages/db/src/index";
import { sellerLocationsQuery } from "../../packages/api/src/routers/helpers/seller-directory";
try {
  const result = await db.execute(sellerLocationsQuery());
  console.log(JSON.stringify({locations:result.rows, totalSellers:result.rows.reduce((sum,row)=>sum + Number(row.count),0)}));
} finally { await db.$client.end(); }
