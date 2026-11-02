import { runComplianceMigrations } from "../db/migrations.js";

export default async (nitroApp: unknown): Promise<void> => {
  await runComplianceMigrations(nitroApp as never);
};
