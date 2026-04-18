import { db } from "../server/db";
import { users, organizations, userOrganizations, subscriptions } from "../drizzle/schema";

async function main() {
  const allUsers = await db.select().from(users);
  console.log("=== USERS ===");
  for (const u of allUsers) {
    console.log(`  ID=${u.id} | email=${u.email} | name=${u.name} | role=${u.role} | loginMethod=${u.loginMethod} | orgId=${u.currentOrganizationId} | verified=${u.emailVerified}`);
  }

  const allOrgs = await db.select().from(organizations);
  console.log("\n=== ORGANIZATIONS ===");
  for (const o of allOrgs) {
    console.log(`  ID=${o.id} | name=${o.name} | slug=${o.slug} | uid=${o.uid} | city=${o.city}`);
  }

  const allUO = await db.select().from(userOrganizations);
  console.log("\n=== USER_ORGANIZATIONS ===");
  for (const uo of allUO) {
    console.log(`  ID=${uo.id} | userId=${uo.userId} | orgId=${uo.organizationId} | role=${uo.role}`);
  }

  const allSubs = await db.select().from(subscriptions);
  console.log("\n=== SUBSCRIPTIONS ===");
  for (const s of allSubs) {
    console.log(`  ID=${s.id} | orgId=${s.organizationId} | userId=${s.userId} | plan=${s.plan} | status=${s.status}`);
  }

  process.exit(0);
}
main();
