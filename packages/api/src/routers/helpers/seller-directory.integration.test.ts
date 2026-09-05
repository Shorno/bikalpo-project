import assert from "node:assert/strict";
import test from "node:test";
import { sql } from "drizzle-orm";
import {
  sellerLocationsQuery,
  sellersByLocationQuery,
} from "./seller-directory";

test(
  "seller counts and directory use registered business locations across seller types",
  { skip: process.env.RUN_SELLER_DIRECTORY_DB_TEST !== "1" },
  async () => {
    const { db } = await import("@bikalpo-project/db");
    const rollback = new Error("rollback fixtures");
    try {
      await db.transaction(async (tx) => {
        // Temporary tables shadow production names for this connection only.
        await tx.execute(
          sql`create temporary table "user" (id text, role text, seller_status text, banned boolean, shop_name text, shop_slug text, warehouse_name text, warehouse_slug text) on commit drop`,
        );
        await tx.execute(
          sql`create temporary table seller_application (id text, user_id text, business_nature text, shop_address text, district text, division text, latitude text, longitude text, updated_at timestamp, status text) on commit drop`,
        );
        await tx.execute(
          sql`create temporary table warehouse_application (like seller_application including all) on commit drop`,
        );
        await tx.execute(
          sql`alter table warehouse_application rename shop_address to warehouse_address`,
        );
        await tx.execute(sql`insert into "user" (id, role, seller_status, banned, shop_name, warehouse_name) values
        ('retail','shop_owner','approved',false,'Retail',''), ('manufacturer','shop_owner','approved',false,'Maker',''),
        ('importer','shop_owner','approved',false,'Importer',''), ('wholesale','warehouse',null,false,'','Wholesale'),
        ('distribution','warehouse',null,false,'','Distributor'), ('warehouse','warehouse',null,false,'','Warehouse'),
        ('admin','admin','approved',false,'Admin',''), ('consumer','consumer','approved',false,'Consumer',''),
        ('staff','shop_staff','approved',false,'Staff',''), ('blocked','shop_owner','approved',true,'Blocked',''),
        ('pending','shop_owner','pending',false,'Pending',''), ('missing','shop_owner','approved',false,'Missing',''),
        ('outside','shop_owner','approved',false,'Outside',''), ('bad','shop_owner','approved',false,'Bad','')`);
        await tx.execute(sql`insert into seller_application
        select id, id, case when id = 'retail' then 'retail_shop' else id end, 'Business address', '  Dhaka ', 'Dhaka', '23.81', '90.41', '2026-01-01', 'approved'
        from "user" where role <> 'warehouse'`);
        await tx.execute(sql`insert into warehouse_application
        select id, id, id, 'Warehouse address', 'ঢাকা', ' ঢাকা বিভাগ ', '23.81', '90.41', '2026-01-01', 'approved' from "user" where role = 'warehouse'`);
        // Duplicate old applications must not inflate counts or leak stale locations.
        await tx.execute(
          sql`insert into seller_application values ('old','retail','retail_shop','Old address','Gazipur','Dhaka','24','90','2025-01-01','approved')`,
        );
        await tx.execute(
          sql`update seller_application set latitude = null where id = 'missing'`,
        );
        await tx.execute(
          sql`update seller_application set latitude = '51' where id = 'outside'`,
        );
        await tx.execute(
          sql`update seller_application set latitude = 'not-a-coordinate' where id = 'bad'`,
        );
        const locations = await tx.execute(sellerLocationsQuery());
        assert.equal(locations.rows.length, 1);
        assert.equal(locations.rows[0]?.count, 6);
        assert.equal(locations.rows[0]?.districtKey, "dhaka");
        const list = (
          await tx.execute(sellersByLocationQuery(" DHAKA ", "dhaka", 1, 24))
        ).rows[0] as { totalCount: number; sellers: { id: string }[] };
        assert.equal(list.totalCount, 6);
        assert.deepEqual(
          list.sellers.map((s) => s.id).sort(),
          [
            "retail",
            "manufacturer",
            "importer",
            "wholesale",
            "distribution",
            "warehouse",
          ].sort(),
        );
        const lastPage = (
          await tx.execute(sellersByLocationQuery("Dhaka", "Dhaka", 99, 2))
        ).rows[0] as { page: number; totalPages: number; sellers: unknown[] };
        assert.equal(lastPage.page, 3);
        assert.equal(lastPage.totalPages, 3);
        assert.equal(lastPage.sellers.length, 2);
        const empty = (
          await tx.execute(sellersByLocationQuery("Gazipur", "Dhaka"))
        ).rows[0] as { totalCount: number; sellers: unknown[] };
        assert.equal(empty.totalCount, 0);
        assert.deepEqual(empty.sellers, []);
        // Changing the current registration moves exactly one account.
        await tx.execute(
          sql`update seller_application set district = 'Gazipur' where id = 'retail'`,
        );
        const moved = (await tx.execute(sellerLocationsQuery())).rows;
        assert.equal(
          moved.find((row) => row.districtKey === "dhaka")?.count,
          5,
        );
        assert.equal(
          moved.find((row) => row.districtKey === "gazipur")?.count,
          1,
        );
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    } finally {
      await db.$client.end();
    }
  },
);
