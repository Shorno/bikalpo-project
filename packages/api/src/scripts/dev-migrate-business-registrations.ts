/** Development data migration. Preview by default; --apply commits one transaction. */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "@bikalpo-project/db";
import {
  provisionRetailerFreeSubscription,
  retailerSubscriptionEligibility,
  type SubscriptionTransaction,
} from "@bikalpo-project/db/retailer-subscription-provisioning";
import {
  kycVerification,
  sellerApplication,
  user,
  warehouseApplication,
} from "@bikalpo-project/db/schema";
import { eq, sql } from "drizzle-orm";
const requireWebConstants = createRequire(import.meta.url);
const {
  bangladeshDistrictsByDivision,
  bangladeshDivisions,
  normalizeBangladeshDistrict,
  normalizeBangladeshDivision,
} = requireWebConstants(
  "../../../../apps/web/constants/bangladesh-locations.ts",
) as typeof import("../../../../apps/web/constants/bangladesh-locations");
const { areasForUpazila, upazilasForDistrict } = requireWebConstants(
  "../../../../apps/web/constants/property-location-options.ts",
) as {
  areasForUpazila: (
    division: string,
    district: string,
    upazila: string,
  ) => string[];
  upazilasForDistrict: (division: string, district: string) => string[];
};
import {
  BUSINESS_NATURES,
  resolveBusinessRegistration,
  type BusinessNature,
} from "../business-registration";
import { buildSharedApplicationValues } from "../routers/helpers/application-fields";
import { retailerBusinessLocationSchema } from "../routers/helpers/retailer-profile-fields";
import { sellerApplicationInputSchema } from "../routers/seller-application";
import { warehouseApplicationInputSchema } from "../routers/warehouse-application";

const MARKER = "[DEV registration migration v1]";
const here = path.dirname(fileURLToPath(import.meta.url));
const backupDirectory = path.resolve(
  here,
  "../../.cache/registration-migration",
);
type Owner = typeof user.$inferSelect;
type Application =
  | typeof sellerApplication.$inferSelect
  | typeof warehouseApplication.$inferSelect;
type ProductType = { id: number; name: string; isActive: boolean };
type MigrationSummary = {
  businesses: number;
  shopOwners: number;
  warehouseOwners: number;
  changes: number;
  newApplications: number;
  approvedApplications: number;
  kycApprovals: number;
  newFreeSubscriptions: number;
};
const textValue = (...values: unknown[]) =>
  values.find((v): v is string => typeof v === "string" && !!v.trim())?.trim();
const key = (value: string) => value.trim().toLowerCase();
const shortId = (value: string) =>
  createHash("sha256").update(value).digest("hex").slice(0, 8);

function changes<T extends object>(
  before: object | undefined,
  after: T,
): Partial<T> {
  return Object.fromEntries(
    Object.entries(after).filter(
      ([field, value]) =>
        JSON.stringify(
          (before as Record<string, unknown> | undefined)?.[field],
        ) !== JSON.stringify(value),
    ),
  ) as Partial<T>;
}

function canonicalDivision(value: string | null | undefined) {
  return normalizeBangladeshDivision(
    (value || "").replace(/^ঢাকা(?: বিভাগ)?$/, "Dhaka"),
  );
}

function locationFor(
  owner: Owner,
  application: Application | undefined,
  warehouse: boolean,
  defaults: string[],
) {
  const address = textValue(
    warehouse ? owner.warehouseAddress : owner.shopAddress,
    application &&
      ("shopAddress" in application
        ? application.shopAddress
        : application.warehouseAddress),
  );
  const source = [address, application?.area].filter(Boolean).join(", ");
  let division = canonicalDivision(application?.division);
  let district = normalizeBangladeshDistrict(
    (application?.district || "").replace(/^ঢাকা(?: জেলা)?$/, "Dhaka"),
    division,
  );
  if (!district) {
    for (const candidate of bangladeshDivisions) {
      const found = bangladeshDistrictsByDivision[candidate].find(
        (name) =>
          key(application?.district || "") === key(name) ||
          source.toLowerCase().includes(key(name)),
      );
      if (found) {
        division = candidate;
        district = found;
        break;
      }
    }
  }
  if (!district && /savar/i.test(source)) {
    division = "Dhaka";
    district = "Dhaka";
  }
  if (!district) {
    division = "Dhaka";
    district = "Dhaka";
    defaults.push("business division/district: Dhaka development default");
  }
  const upazilas = upazilasForDistrict(division, district);
  const originalThana =
    application && "thana" in application
      ? textValue(application.thana)
      : undefined;
  const candidates = upazilas
    .map((thana) => {
      const labels = [
        thana,
        thana.replace(/ Thana$/i, ""),
        ...areasForUpazila(division, district, thana),
      ];
      const score = Math.max(
        0,
        ...labels
          .filter((label) => source.toLowerCase().includes(key(label)))
          .map((label) => label.length),
      );
      return { thana, score };
    })
    .sort((a, b) => b.score - a.score || a.thana.localeCompare(b.thana));
  const canonicalThana =
    originalThana &&
    upazilas.find(
      (name) =>
        key(name.replace(/ Thana$/i, "")) ===
        key(originalThana.replace(/ Thana$/i, "")),
    );
  let thana =
    canonicalThana ||
    originalThana ||
    (candidates[0]?.score ? candidates[0].thana : undefined);
  if (!thana && /সেনানিবাস/.test(source)) thana = "Cantonment";
  if (!thana && /bashundhara|nadda/i.test(source)) thana = "Vatara";
  if (!thana) {
    thana = "Development test thana";
    defaults.push("business thana: development sample");
  }
  let area = textValue(application?.area);
  if (!area && address) {
    area =
      areasForUpazila(division, district, thana)
        .filter((label) =>
          source.toLowerCase().includes(key(label.replace(/ Union$/i, ""))),
        )
        .sort((a, b) => b.length - a.length)[0] ||
      address.split(",")[0]?.trim();
  }
  if (!area) {
    area = "Development test area";
    defaults.push("business area: development sample");
  }
  let latitude = textValue(
    application?.latitude,
    warehouse ? owner.warehouseLat : owner.shopLat,
  );
  let longitude = textValue(
    application?.longitude,
    warehouse ? owner.warehouseLng : owner.shopLng,
  );
  if (
    !latitude ||
    !longitude ||
    !Number.isFinite(Number(latitude)) ||
    !Number.isFinite(Number(longitude))
  ) {
    latitude = "23.8103";
    longitude = "90.4125";
    defaults.push("business coordinates: Dhaka development sample");
  }
  if (!address) defaults.push("business address: development sample");
  return {
    division,
    district,
    thana,
    area,
    latitude,
    longitude,
    address: address || `Development test business, ${area}, ${district}`,
  };
}

function productTypeFor(
  application: Application | undefined,
  types: ProductType[],
  evidence: number[],
  defaults: string[],
) {
  const active = types.filter((t) => t.isActive);
  let found = active.find((t) => t.id === application?.productTypeId);
  const category = application?.businessCategory || "";
  if (!found) found = active.find((t) => key(t.name) === key(category));
  const aliases = [
    /fashion|clothing/i.test(category) ? "Fashion" : "",
    /mobile|electronic/i.test(category) ? "Electronics" : "",
    /food|beverage|grocery/i.test(category) ? "Grocery" : "",
  ];
  if (!found) found = active.find((t) => aliases.includes(t.name));
  if (!found)
    found = evidence.map((id) => active.find((t) => t.id === id)).find(Boolean);
  if (!found) {
    found =
      active.find((t) => t.name === "Grocery") ||
      active.sort((a, b) => a.id - b.id)[0];
    defaults.push(
      `product type: ${found?.name} development default (legacy category: ${category || "missing"})`,
    );
  }
  assert.ok(found, "At least one active product type is required");
  return found;
}

async function snapshot(tx: SubscriptionTransaction) {
  return {
    users: await tx.query.user.findMany({ orderBy: [user.createdAt, user.id] }),
    sellers: await tx.query.sellerApplication.findMany(),
    warehouses: await tx.query.warehouseApplication.findMany(),
    kycs: await tx.query.kycVerification.findMany(),
    subscriptions: await tx.query.retailerSubscription.findMany(),
    types: await tx.query.productType.findMany(),
  };
}

async function migrate(
  tx: SubscriptionTransaction,
  webOrigin: string,
  apply: boolean,
): Promise<MigrationSummary> {
  // Exclude concurrent registration writes while allocating application numbers.
  if (apply)
    await tx.execute(
      sql`LOCK TABLE "user", seller_application, warehouse_application, kyc_verification, retailer_subscription IN SHARE ROW EXCLUSIVE MODE`,
    );
  const before = await snapshot(tx);
  const businessUsers = before.users.filter(
    (u) =>
      ["shop_owner", "warehouse"].includes(u.role || "") ||
      [...before.sellers, ...before.warehouses].some((a) => a.userId === u.id),
  );
  const admins = before.users.filter((u) => u.role === "admin" && !u.banned);
  assert.equal(
    admins.length,
    1,
    "Expected exactly one active development admin",
  );
  const adminId = admins[0]!.id;
  const evidence = await tx.execute<{
    owner_id: string;
    type_id: number;
    weight: number;
  }>(sql`
    SELECT owner_id, type_id, sum(weight)::int AS weight FROM (
      SELECT created_by_id AS owner_id, c.type_id, count(*) * 3 AS weight
      FROM product p JOIN category c ON c.id = p.category_id GROUP BY created_by_id, c.type_id
      UNION ALL
      SELECT i.owner_id, c.type_id, count(*) AS weight FROM inventory i
      JOIN product_variant v ON v.id = i.variant_id JOIN product p ON p.id = v.product_id
      JOIN category c ON c.id = p.category_id GROUP BY i.owner_id, c.type_id
      UNION ALL
      SELECT a.shop_id, c.type_id, count(*) AS weight FROM shop_category_assignment a
      JOIN category c ON c.id = a.category_id GROUP BY a.shop_id, c.type_id
      UNION ALL
      SELECT a.warehouse_id, c.type_id, count(*) AS weight FROM warehouse_category_assignment a
      JOIN category c ON c.id = a.category_id GROUP BY a.warehouse_id, c.type_id
    ) evidence WHERE owner_id IS NOT NULL AND type_id IS NOT NULL
    GROUP BY owner_id, type_id ORDER BY owner_id, weight DESC, type_id`);
  const numbers = new Set(
    [...before.sellers, ...before.warehouses].map((a) => a.applicationNumber),
  );
  const slugs = new Set(
    before.users.flatMap((u) => [u.shopSlug, u.warehouseSlug]),
  );
  const now = new Date();
  const sampleUrl = `${webOrigin}/dev-fixtures/registration-sample.svg`;
  const plans = businessUsers.map((owner) => {
    assert.ok(
      ["consumer", "shop_owner", "warehouse"].includes(owner.role || ""),
      `Unexpected role on applicant ${owner.id}`,
    );
    const applications = [...before.sellers, ...before.warehouses].filter(
      (a) => a.userId === owner.id,
    );
    assert.ok(
      applications.length <= 1,
      `Multiple registrations for ${owner.id}; consolidate explicitly before migrating`,
    );
    const application = applications[0];
    const warehouse = application
      ? "warehouseName" in application
      : owner.role === "warehouse";
    assert.ok(
      owner.role === "consumer" ||
        (warehouse ? owner.role === "warehouse" : owner.role === "shop_owner"),
      `Portal/application mismatch for ${owner.id}`,
    );
    const defaults: string[] = [];
    const nature = (textValue(application?.businessNature) ||
      (warehouse ? "wholesaler" : "retail_shop")) as BusinessNature;
    assert.ok(
      BUSINESS_NATURES.includes(nature),
      `Unknown business nature for ${owner.id}`,
    );
    assert.equal(
      resolveBusinessRegistration(nature).applicationPath,
      warehouse ? "warehouse" : "seller",
    );
    const productType = productTypeFor(
      application,
      before.types,
      evidence.rows
        .filter((row) => row.owner_id === owner.id)
        .map((row) => row.type_id),
      defaults,
    );
    const location = locationFor(owner, application, warehouse, defaults);
    const businessName = textValue(
      warehouse ? owner.warehouseName : owner.shopName,
      application &&
        ("shopName" in application
          ? application.shopName
          : application.warehouseName),
      owner.name,
    )!;
    let applicationNumber = application?.applicationNumber;
    if (!applicationNumber) {
      const prefix = `${warehouse ? "WAREHOUSE" : "SELLER"}-${now.getFullYear()}-`;
      let sequence = 1;
      while (numbers.has(`${prefix}${String(sequence).padStart(6, "0")}`))
        sequence++;
      applicationNumber = `${prefix}${String(sequence).padStart(6, "0")}`;
      numbers.add(applicationNumber);
    }
    const documentUrls = { ...application?.documentUrls };
    for (const field of ["tradeLicense", "shopPhoto", "storeFront"] as const) {
      if (!documentUrls[field]) {
        documentUrls[field] = sampleUrl;
        defaults.push(`${field}: development attachment`);
      }
    }
    if (!textValue(application?.tradeLicenseNumber))
      defaults.push("trade license number: DEV-SAMPLE identifier");
    let phoneNumber = textValue(application?.phoneNumber, owner.phoneNumber);
    if (!phoneNumber) {
      phoneNumber = "00000000000";
      defaults.push(
        "registration phone: non-dialable development sample; login unchanged",
      );
    }
    const personalAddress =
      textValue(application?.personalAddress) || location.address;
    const hasPersonalCoordinates = !!(
      application?.personalLatitude && application?.personalLongitude
    );
    if (!application?.personalAddress || !hasPersonalCoordinates)
      defaults.push("personal location: development copy of business location");
    const input = {
      ...Object.fromEntries(
        Object.entries(application || {}).map(([field, value]) => [
          field,
          value ?? undefined,
        ]),
      ),
      ownerName: textValue(owner.ownerName, application?.ownerName, owner.name),
      phoneNumber,
      email: textValue(application?.email, owner.email),
      profilePhotoUrl: textValue(application?.profilePhotoUrl, owner.image),
      businessNature: nature,
      productTypeId: productType.id,
      ...location,
      personalAddress,
      personalLatitude: hasPersonalCoordinates
        ? application!.personalLatitude!
        : location.latitude,
      personalLongitude: hasPersonalCoordinates
        ? application!.personalLongitude!
        : location.longitude,
      personalDivision:
        canonicalDivision(application?.personalDivision) || location.division,
      personalDistrict:
        normalizeBangladeshDistrict(
          (application?.personalDistrict || "").replace(/^ঢাকা$/, "Dhaka"),
          canonicalDivision(application?.personalDivision) || location.division,
        ) || location.district,
      personalArea: textValue(application?.personalArea) || location.area,
      selectedPlan: warehouse ? "free_trial" : "free",
      tradeLicenseNumber:
        textValue(application?.tradeLicenseNumber) ||
        `DEV-SAMPLE-${applicationNumber}`,
      documentUrls,
      documents: [
        ...new Set([
          ...(application?.documents || []),
          ...Object.values(documentUrls).filter((url): url is string => !!url),
        ]),
      ],
      ...(warehouse
        ? { warehouseName: businessName, warehouseAddress: location.address }
        : {
            shopName: businessName,
            shopAddress: location.address,
            businessType:
              application && "businessType" in application
                ? application.businessType
                : owner.businessType || "retail",
          }),
    };
    const parsed = warehouse
      ? warehouseApplicationInputSchema.parse(input)
      : sellerApplicationInputSchema.parse(input);
    retailerBusinessLocationSchema.parse(location);
    assert.ok(
      Number(parsed.personalLatitude) && Number(parsed.personalLongitude),
      `Incomplete personal location for ${owner.id}`,
    );
    assert.ok(
      parsed.documentUrls?.tradeLicense &&
        parsed.documentUrls.shopPhoto &&
        parsed.documentUrls.storeFront,
    );
    const shared = buildSharedApplicationValues(parsed, productType.name);
    const note = `${MARKER} User-authorized development backfill and approval. ${defaults.length ? `Sample fields: ${defaults.join("; ")}.` : "Existing registration details retained."}`;
    const values = {
      ...shared,
      applicationNumber,
      ...(warehouse
        ? { warehouseName: businessName, warehouseAddress: location.address }
        : {
            shopName: businessName,
            shopAddress: location.address,
            businessType: (input as { businessType: string }).businessType,
            thana: location.thana,
          }),
      status: "approved",
      reviewedBy:
        application?.status === "approved" && application.reviewedBy
          ? application.reviewedBy
          : adminId,
      reviewedAt:
        application?.status === "approved" && application.reviewedAt
          ? application.reviewedAt
          : now,
      adminNotes: application?.adminNotes?.includes(MARKER)
        ? application.adminNotes
        : [application?.adminNotes, note].filter(Boolean).join("\n"),
    };
    let slug = warehouse ? owner.warehouseSlug : owner.shopSlug;
    if (!slug) {
      const base =
        businessName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 50) || `dev-business-${shortId(owner.id)}`;
      slug = slugs.has(base) ? `${base}-${shortId(owner.id)}` : base;
      assert.ok(!slugs.has(slug), `Slug collision for ${owner.id}`);
      slugs.add(slug);
    }
    const ownerValues = warehouse
      ? {
          role: "warehouse",
          ownerName: shared.ownerName,
          warehouseName: businessName,
          warehouseAddress: location.address,
          warehouseSlug: slug,
          warehouseLat: location.latitude,
          warehouseLng: location.longitude,
          banned: false,
          banReason: null,
          banExpires: null,
        }
      : {
          role: "shop_owner",
          ownerName: shared.ownerName,
          shopName: businessName,
          shopAddress: location.address,
          shopSlug: slug,
          shopLat: location.latitude,
          shopLng: location.longitude,
          businessType: (input as { businessType: string }).businessType,
          isSeller:
            (input as { businessType: string }).businessType === "retail",
          sellerStatus: "approved",
          banned: false,
          banReason: null,
          banExpires: null,
        };
    const latestKyc = before.kycs
      .filter((k) => k.userId === owner.id)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    const kycValues =
      latestKyc?.status === "verified"
        ? {}
        : {
            status: "verified",
            reviewedBy: adminId,
            reviewedAt: now,
            adminNotes: [
              latestKyc?.adminNotes,
              `${MARKER} Development-only KYC approval at the project owner's request; not an identity/document verification.`,
            ]
              .filter(Boolean)
              .join("\n"),
          };
    return {
      owner,
      application,
      warehouse,
      businessName,
      values,
      defaults,
      applicationPatch: changes(application, values),
      ownerPatch: changes(owner, ownerValues),
      latestKyc,
      kycPatch: changes(latestKyc, kycValues),
      needsSubscription:
        !warehouse &&
        "isSeller" in ownerValues &&
        ownerValues.isSeller &&
        !before.subscriptions.some((t) => t.shopId === owner.id && t.isCurrent),
    };
  });
  const changed = plans.filter(
    (p) =>
      Object.keys(p.applicationPatch).length ||
      Object.keys(p.ownerPatch).length ||
      Object.keys(p.kycPatch).length ||
      p.needsSubscription,
  );
  const summary = {
    businesses: plans.length,
    shopOwners: plans.filter((p) => !p.warehouse).length,
    warehouseOwners: plans.filter((p) => p.warehouse).length,
    changes: changed.length,
    newApplications: plans.filter((p) => !p.application).length,
    approvedApplications: plans.filter(
      (p) => p.application?.status !== "approved",
    ).length,
    kycApprovals: plans.filter((p) => p.latestKyc?.status !== "verified")
      .length,
    newFreeSubscriptions: plans.filter((p) => p.needsSubscription).length,
  };
  console.log(
    JSON.stringify({ mode: apply ? "apply" : "preview", ...summary }),
  );
  for (const p of changed)
    console.log(
      JSON.stringify({
        business: p.businessName,
        path: p.warehouse ? "warehouse" : "seller",
        applicationNumber: p.values.applicationNumber,
        businessNature: p.values.businessNature,
        productType: p.values.businessCategory,
        applicationFields: Object.keys(p.applicationPatch),
        accountFields: Object.keys(p.ownerPatch),
        developmentDefaults: p.defaults,
      }),
    );
  if (!apply || !changed.length) return summary;
  await mkdir(backupDirectory, { recursive: true });
  const backupPath = path.join(
    backupDirectory,
    `before-${now.toISOString().replace(/[:.]/g, "-")}.json`,
  );
  const ids = new Set(plans.map((p) => p.owner.id));
  await writeFile(
    backupPath,
    JSON.stringify(
      {
        ...before,
        users: before.users.filter((u) => ids.has(u.id)),
        kycs: before.kycs.filter((k) => ids.has(k.userId)),
        migration: MARKER,
        summary,
      },
      null,
      2,
    ),
    { flag: "wx" },
  );
  console.log(`Backup: ${backupPath}`);
  for (const p of changed) {
    if (Object.keys(p.ownerPatch).length)
      await tx.update(user).set(p.ownerPatch).where(eq(user.id, p.owner.id));
    if (p.warehouse) {
      if (!p.application)
        await tx.insert(warehouseApplication).values({
          ...p.values,
          userId: p.owner.id,
        } as typeof warehouseApplication.$inferInsert);
      else if (Object.keys(p.applicationPatch).length)
        await tx
          .update(warehouseApplication)
          .set(p.applicationPatch)
          .where(eq(warehouseApplication.id, p.application.id));
    } else {
      if (!p.application)
        await tx.insert(sellerApplication).values({
          ...p.values,
          userId: p.owner.id,
        } as typeof sellerApplication.$inferInsert);
      else if (Object.keys(p.applicationPatch).length)
        await tx
          .update(sellerApplication)
          .set(p.applicationPatch)
          .where(eq(sellerApplication.id, p.application.id));
    }
    if (!p.latestKyc)
      await tx
        .insert(kycVerification)
        .values({ ...p.kycPatch, userId: p.owner.id, id: randomUUID() });
    else if (Object.keys(p.kycPatch).length)
      await tx
        .update(kycVerification)
        .set(p.kycPatch)
        .where(eq(kycVerification.id, p.latestKyc.id));
    if (
      !p.warehouse &&
      "businessType" in p.values &&
      p.values.businessType === "retail"
    ) {
      const result = await provisionRetailerFreeSubscription(
        tx,
        p.owner.id,
        "backfill",
      );
      assert.ok(
        result === "created" || result === "existing",
        `Subscription provisioning failed: ${result}`,
      );
    }
  }
  const after = await snapshot(tx);
  assert.deepEqual(
    after.subscriptions
      .filter((t) => before.subscriptions.some((old) => old.id === t.id))
      .sort((a, b) => a.id.localeCompare(b.id)),
    before.subscriptions.sort((a, b) => a.id.localeCompare(b.id)),
    "Existing subscription terms must be preserved",
  );
  assert.deepEqual(
    after.users.filter((u) => !ids.has(u.id)),
    before.users.filter((u) => !ids.has(u.id)),
    "Non-business accounts must be preserved",
  );
  for (const p of plans) {
    const owner = after.users.find((u) => u.id === p.owner.id)!;
    for (const field of [
      "email",
      "phoneNumber",
      "emailVerified",
      "phoneNumberVerified",
      "loginVerification",
    ] as const)
      assert.deepEqual(
        owner[field],
        p.owner[field],
        `Login identity changed: ${p.owner.id}`,
      );
    const apps = (p.warehouse ? after.warehouses : after.sellers).filter(
      (a) => a.userId === owner.id,
    );
    assert.equal(apps.length, 1);
    assert.equal(apps[0]!.status, "approved");
    assert.equal(
      after.kycs
        .filter((k) => k.userId === owner.id)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]!
        .status,
      "verified",
    );
    if (!p.warehouse && owner.businessType === "retail")
      assert.equal(
        await retailerSubscriptionEligibility(tx, owner.id),
        "eligible",
      );
  }
  const rerun = await migrate(tx, webOrigin, false);
  assert.equal(rerun.changes, 0, "The migration must be idempotent");
  return summary;
}

try {
  assert.notEqual(
    process.env.NODE_ENV,
    "production",
    "This migration is development-only",
  );
  const args = process.argv.slice(2);
  assert.ok(
    args.every(
      (arg) =>
        arg === "--apply" ||
        arg === "--rehearse" ||
        arg.startsWith("--web-origin="),
    ),
    "Unknown argument",
  );
  assert.ok(
    !(args.includes("--apply") && args.includes("--rehearse")),
    "Choose --apply or --rehearse",
  );
  const webOrigin = new URL(
    args
      .find((arg) => arg.startsWith("--web-origin="))
      ?.slice("--web-origin=".length) || "http://bikalpo.localhost:3001",
  ).origin;
  assert.ok(
    /^https?:/.test(webOrigin),
    "A web origin is required for sample attachments",
  );
  const rollback = new Error("Development migration rehearsal rollback");
  await db
    .transaction(async (tx) => {
      const result = await migrate(
        tx,
        webOrigin,
        args.includes("--apply") || args.includes("--rehearse"),
      );
      if (args.includes("--rehearse")) throw rollback;
      return result;
    })
    .catch((error) => {
      if (error !== rollback) throw error;
      console.log("Rehearsal passed; all database changes rolled back.");
    });
  if (args.includes("--apply"))
    console.log("Development registration migration committed.");
} catch (error) {
  // Do not dump driver errors: they may contain connection details or private values.
  console.error(
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : "Registration migration failed",
  );
  process.exitCode = 1;
} finally {
  await db.$client.end();
}
