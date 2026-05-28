#!/usr/bin/env node
/**
 * Dry-run only: valideert manifest en omgeving, toont geplande acties.
 * Schrijft nog niets naar Supabase (geen Auth/profiles mutaties).
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");
const MANIFEST_PATH = join(__dirname, "manifest.json");
const ENV_PATH = join(REPO_ROOT, ".env");

const REQUIRED_GLOBAL_ENV = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];

function loadDotEnv(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, "utf8");

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const eq = trimmed.indexOf("=");
    if (eq === -1) {
      continue;
    }

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function loadManifest() {
  const raw = readFileSync(MANIFEST_PATH, "utf8");
  return JSON.parse(raw);
}

function isSet(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function maskEmail(email) {
  const at = email.indexOf("@");
  if (at <= 1) {
    return "(ingevuld)";
  }
  return `${email.slice(0, 1)}***${email.slice(at)}`;
}

function collectUserEnvKeys(user) {
  return [user.emailEnvKey, user.passwordEnvKey, user.displayNameEnvKey].filter(Boolean);
}

function main() {
  console.log("=== seed-test-users (DRY-RUN ONLY) ===\n");
  console.log("Modus: dry-run. Er worden geen wijzigingen naar Supabase geschreven.\n");

  loadDotEnv(ENV_PATH);

  if (!existsSync(ENV_PATH)) {
    console.warn(`Waarschuwing: ${ENV_PATH} niet gevonden. Alleen process.env wordt gebruikt.\n`);
  }

  const manifest = loadManifest();
  const errors = [];
  const warnings = [];

  console.log("--- Globale omgevingsvariabelen ---");

  for (const key of REQUIRED_GLOBAL_ENV) {
    const ok = isSet(process.env[key]);
    if (key === "SUPABASE_SERVICE_ROLE_KEY") {
      console.log(`  ${key}: ${ok ? "aanwezig (waarde niet getoond)" : "ONTBREEKT"}`);
    } else {
      const value = process.env[key];
      console.log(`  ${key}: ${ok ? value.trim() : "ONTBREEKT"}`);
    }
    if (!ok) {
      errors.push(`Ontbrekende omgevingsvariabele: ${key}`);
    }
  }

  const supabaseUrl = process.env.SUPABASE_URL?.trim() ?? "";
  const expectedUrl = manifest.supabaseUrlMustMatch?.trim() ?? "";

  if (expectedUrl && supabaseUrl && supabaseUrl !== expectedUrl) {
    errors.push(
      `SUPABASE_URL komt niet overeen met manifest (${expectedUrl}). Controleer js/auth.js en .env.`,
    );
  } else if (expectedUrl && supabaseUrl) {
    console.log(`  SUPABASE_URL komt overeen met manifest (${expectedUrl}).`);
  }

  console.log("\n--- Allowlist (env-keys, geen wachtwoorden) ---");

  for (const user of manifest.users) {
    const keys = collectUserEnvKeys(user);
    console.log(`  [${user.id}] ${user.label}`);
    console.log(`    role=${user.role}, status=${user.status}`);
    for (const envKey of keys) {
      const ok = isSet(process.env[envKey]);
      console.log(`    ${envKey}: ${ok ? "ingevuld" : "ONTBREEKT"}`);
      if (!ok) {
        errors.push(`Ontbrekende omgevingsvariabele voor ${user.id}: ${envKey}`);
      }
    }
  }

  const addr = manifest.testAddress ?? {};

  console.log("\n--- Vaste testadresvelden (manifest) ---");
  console.log(`  street: ${addr.street ?? "-"}`);
  console.log(`  house_number: ${addr.house_number ?? "-"}`);
  console.log(`  postal_code: ${addr.postal_code ?? "-"}`);
  console.log(`  city: ${addr.city ?? "-"}`);
  console.log(`  phone: ${addr.phone ?? "-"}`);

  console.log("\n--- Geplande acties (nog niet uitgevoerd) ---");

  for (const user of manifest.users) {
    const email = process.env[user.emailEnvKey]?.trim().toLowerCase() ?? "";
    const displayName = process.env[user.displayNameEnvKey]?.trim() ?? "";

    if (!email) {
      console.log(`  - [${user.id}] Overgeslagen: ${user.emailEnvKey} niet ingevuld.`);
      continue;
    }

    console.log(`  - [${user.id}] Zou Auth-user zoeken of aanmaken voor e-mail uit ${user.emailEnvKey} (${maskEmail(email)}).`);
    console.log(
      `    Zou wachtwoord zetten via ${user.passwordEnvKey} (waarde niet getoond).`,
    );
    console.log(
      `    Zou profiel upserten: full_name uit ${user.displayNameEnvKey}` +
        (displayName ? ` ("${displayName}")` : " (nog leeg)") +
        `, role=${user.role}, status=${user.status}.`,
    );
    console.log(
      `    Zou adresvelden zetten: ${addr.street}, ${addr.house_number}, ${addr.postal_code}, ${addr.city}, phone=${addr.phone ?? "null"}.`,
    );

    if (user.status === "pending") {
      console.log("    Opmerking: pending blijft pending tot dashboard-activatie (geen seed-activatie).");
    }
    if (user.status === "inactive") {
      console.log("    Opmerking: inactive - login ledenportaal wordt geblokkeerd.");
    }
  }

  console.log("\n--- Samenvatting ---");
  console.log(`  Manifest: ${MANIFEST_PATH}`);
  console.log(`  Gebruikers in allowlist: ${manifest.users.length}`);
  console.log("  Supabase-mutaties: geen (dry-run-only).");

  if (errors.length > 0) {
    console.log("\nFouten:");
    for (const message of errors) {
      console.log(`  - ${message}`);
    }
  }

  if (warnings.length > 0) {
    console.log("\nWaarschuwingen:");
    for (const message of warnings) {
      console.log(`  - ${message}`);
    }
  }

  if (errors.length > 0) {
    console.log("\nDry-run afgerond met fouten. Los env-vars op voor een toekomstige --apply-stap.\n");
    process.exitCode = 1;
    return;
  }

  console.log("\nDry-run geslaagd. Geen data geschreven naar Supabase.\n");
}

main();
