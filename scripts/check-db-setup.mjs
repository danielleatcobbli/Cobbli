#!/usr/bin/env node
/**
 * Checks that the recorded database setup still contains what the site needs.
 *
 * This does not connect to the live database and does not change any data.
 * Rahul can run it before a release: `npm run db:check`
 *
 * Exit 0: the migration files agree with each other.
 * Exit 1: a required table, column, bucket, or access rule is missing
 *         from the recorded setup.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const migrationsDir = join(root, "supabase", "migrations");
const files = readdirSync(migrationsDir)
  .filter((name) => name.endsWith(".sql"))
  .sort();

const sql = files
  .map((name) => readFileSync(join(migrationsDir, name), "utf8"))
  .join("\n");

const required = [
  "CREATE TABLE IF NOT EXISTS public.order_notes",
  "CREATE TABLE IF NOT EXISTS public.order_pairs",
  "CREATE TABLE IF NOT EXISTS public.pair_photos",
  "workshop_assignee",
  "dispatch_assignee",
  "qc_status",
  "'assessment-uploads'",
  "'blog-images'",
  "get_guest_order_by_session",
  "get_guest_order",
  'DROP POLICY IF EXISTS "Guests view own orders by id"',
  "Staff view order notes",
  "Customers view own pair photos",
  "Staff read assessment uploads",
  "INSERT INTO public.service_areas",
  "INSERT INTO public.pricing_config",
  "INSERT INTO public.repair_packages",
];

const missing = required.filter((snippet) => !sql.includes(snippet));

const seed = readFileSync(join(root, "supabase", "seed.sql"), "utf8");
const customerInsert = /insert\s+into\s+public\.(orders|assessments|profiles|order_notes|order_pairs|pair_photos|payment_methods)\b/i.test(
  seed,
);

const guestList = files.filter((name) =>
  readFileSync(join(migrationsDir, name), "utf8").includes(
    'CREATE POLICY "Guests view own orders by id"',
  ),
);
const guestDrop = files.filter((name) =>
  readFileSync(join(migrationsDir, name), "utf8").includes(
    'DROP POLICY IF EXISTS "Guests view own orders by id"',
  ),
);
const dropComesAfterCreate =
  guestList.length > 0 &&
  guestDrop.length > 0 &&
  guestDrop[guestDrop.length - 1] > guestList[guestList.length - 1];

const problems = [];
if (missing.length > 0) {
  problems.push(`Recorded setup is missing:\n- ${missing.join("\n- ")}`);
}
if (customerInsert) {
  problems.push("supabase/seed.sql inserts customer records. It must stay empty of those.");
}
if (!dropComesAfterCreate) {
  problems.push(
    "The open guest-order list rule is not removed by a later migration.",
  );
}

console.log(`Checked ${files.length} migration files.`);
if (problems.length > 0) {
  console.error(problems.join("\n\n"));
  process.exit(1);
}

console.log("Recorded setup includes staff notes, assignments, pair photos, photo buckets, catalog rows, and the one-order guest lookup.");
console.log("");
console.log("Still not in the recorded setup, on purpose:");
console.log("- Quality-check triggers that move an order to ready-for-return. They exist on the live database, but their original text was never saved here. Copying a guess over them could change a working repair.");
console.log("- Guest repair photos under assessment-uploads/guest can still be opened by anyone who can reach that folder. The repair form uses that today. Narrowing it needs a product decision.");
console.log("- A customer's own order still includes the staff assignee fields, because customers and staff share one database login.");
console.log("");
console.log("These files are not applied to the live database by this check.");
