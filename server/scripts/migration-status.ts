/**
 * Check migration status
 * Usage: tsx scripts/migration-status.ts
 */

import dotenv from "dotenv";
import { MigrationRunner } from "../src/db/migrations";

// Load environment variables
dotenv.config();

async function main() {
  console.log("📊 DataLens AI Migration Status");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const config = {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432", 10),
    database: process.env.DB_NAME || "datalens_ai",
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "",
    ssl: process.env.DB_SSL === "true",
  };

  const runner = new MigrationRunner(config);

  try {
    // Test connection
    const isConnected = await runner.testConnection();
    if (!isConnected) {
      throw new Error("Failed to connect to database");
    }
    console.log("✓ Database connection successful\n");

    // Get migration status
    const status = await runner.getMigrationStatus();

    console.log(`Total migrations: ${status.total}`);
    console.log(`Executed: ${status.executed.length}`);
    console.log(`Pending: ${status.pending.length}\n`);

    if (status.executed.length > 0) {
      console.log("✅ Executed migrations:");
      status.executed.forEach((migration) => {
        console.log(`  - ${migration}`);
      });
      console.log();
    }

    if (status.pending.length > 0) {
      console.log("⏳ Pending migrations:");
      status.pending.forEach((migration) => {
        console.log(`  - ${migration}`);
      });
      console.log();
    } else {
      console.log("✅ All migrations are up to date!\n");
    }

    await runner.close();
    process.exit(0);
  } catch (error) {
    console.error("❌ Failed to check migration status:", error);
    await runner.close();
    process.exit(1);
  }
}

main();
