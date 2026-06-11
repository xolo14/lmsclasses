import { neon } from "@neondatabase/serverless";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("Set DATABASE_URL");
    process.exit(1);
  }
  const sql = neon(url);
  const rows = await sql`SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 20`;
  console.log("Recent audit logs:", JSON.stringify(rows, null, 2));
}

main().catch((err) => {
  console.error("FAIL:", err.message ?? err);
  process.exit(1);
});
