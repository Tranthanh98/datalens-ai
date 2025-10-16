/**
 * Test script to run migrations manually
 * Usage: tsx scripts/run-migrations.ts
 */

import dotenv from "dotenv";
import { runMigrationsFromEnv } from "../src/db/migrations";

// Load environment variables
dotenv.config();

async function main() {
  console.log("🔧 DataLens AI Migration Runner");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  try {
    await runMigrationsFromEnv();
    console.log("\n✅ Migration completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    process.exit(1);
  }
}

main();
