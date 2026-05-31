#!/usr/bin/env node
/**
 * Seed testgebruikers: standaard dry-run (validatie + geplande acties).
 * --apply: Auth-users sync (create/update); public.profiles volgt in een latere stap.
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");
const MANIFEST_PATH = join(__dirname, "manifest.json");
const ENV_PATH = join(REPO_ROOT, ".env");

const REQUIRED_GLOBAL_ENV = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];

function parseArgs(argv) {
  const args = argv.filter((arg) => arg !== "--");

  if (args.length === 0) {
    return { mode: "dry-run" };
  }

  if (args.length === 1 && args[0] === "--dry-run") {
    return { mode: "dry-run" };
  }

  if (args.length === 1 && args[0] === "--apply") {
    return { mode: "apply" };
  }

  throw new Error(
    `Onbekende argumenten: ${args.join(" ")}. Gebruik geen args (dry-run), --dry-run of --apply.`,
  );
}

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

function formatAuthUserPresence(authUserExists, authUserIdAvailable) {
  return `Auth-user bestaat: ${authUserExists ? "ja" : "nee"}, Auth-user id beschikbaar: ${authUserIdAvailable ? "ja" : "nee"}`;
}

function collectUserEnvKeys(user) {
  return [user.emailEnvKey, user.passwordEnvKey, user.displayNameEnvKey].filter(Boolean);
}

function createAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY.trim();

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function canRunAuthLookup(manifest) {
  const supabaseUrl = process.env.SUPABASE_URL?.trim() ?? "";
  const expectedUrl = manifest.supabaseUrlMustMatch?.trim() ?? "";

  return (
    isSet(process.env.SUPABASE_URL) &&
    isSet(process.env.SUPABASE_SERVICE_ROLE_KEY) &&
    (!expectedUrl || supabaseUrl === expectedUrl)
  );
}

async function findAuthUserByEmail(adminClient, email) {
  const targetEmail = email.trim().toLowerCase();
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });

    if (error) {
      return { user: null, error };
    }

    const users = data?.users ?? [];
    const match = users.find((candidate) => candidate.email?.toLowerCase() === targetEmail);

    if (match) {
      return { user: match, error: null };
    }

    if (users.length < perPage) {
      return { user: null, error: null };
    }

    page += 1;
  }
}

async function applyAuthUserForAllowlistEntry(adminClient, manifestUser) {
  const email = process.env[manifestUser.emailEnvKey]?.trim().toLowerCase() ?? "";
  const password = process.env[manifestUser.passwordEnvKey]?.trim() ?? "";

  if (!email || !password) {
    return {
      ok: false,
      message: "e-mail of wachtwoord ontbreekt in env",
      authUserExists: false,
      authUserIdAvailable: false,
      authUserId: null,
    };
  }

  const { user: authUser, error: lookupError } = await findAuthUserByEmail(adminClient, email);

  if (lookupError) {
    return {
      ok: false,
      message: lookupError.message,
      authUserExists: false,
      authUserIdAvailable: false,
      authUserId: null,
    };
  }

  if (!authUser) {
    const { data, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError || !data?.user?.id) {
      return {
        ok: false,
        message: createError?.message ?? "Auth-user aanmaken mislukt",
        authUserExists: false,
        authUserIdAvailable: false,
        authUserId: null,
      };
    }

    return {
      ok: true,
      action: "created",
      authUserExists: true,
      authUserIdAvailable: true,
      authUserId: data.user.id,
    };
  }

  const { error: updateError } = await adminClient.auth.admin.updateUserById(authUser.id, {
    password,
    email_confirm: true,
  });

  if (updateError) {
    return {
      ok: false,
      message: updateError.message,
      authUserExists: true,
      authUserIdAvailable: Boolean(authUser.id),
      authUserId: authUser.id ?? null,
    };
  }

  return {
    ok: true,
    action: "updated",
    authUserExists: true,
    authUserIdAvailable: Boolean(authUser.id),
    authUserId: authUser.id,
  };
}

async function runApplyAuthOnly(manifest) {
  console.log("\n--- Auth apply (geen profiles) ---");

  const adminClient = createAdminClient();
  let succeeded = 0;
  let failed = 0;
  /** @type {Array<{ manifestUserId: string, emailEnvKey: string, email: string, ok: boolean, authUserExists: boolean, authUserIdAvailable: boolean, authUserId: string | null }>} */
  const authContexts = [];

  for (const manifestUser of manifest.users) {
    const email = process.env[manifestUser.emailEnvKey]?.trim().toLowerCase() ?? "";

    if (!email) {
      console.log(`  [${manifestUser.id}] Overgeslagen: ${manifestUser.emailEnvKey} niet ingevuld.`);
      authContexts.push({
        manifestUserId: manifestUser.id,
        emailEnvKey: manifestUser.emailEnvKey,
        email: "",
        ok: false,
        authUserExists: false,
        authUserIdAvailable: false,
        authUserId: null,
      });
      continue;
    }

    const result = await applyAuthUserForAllowlistEntry(adminClient, manifestUser);

    authContexts.push({
      manifestUserId: manifestUser.id,
      emailEnvKey: manifestUser.emailEnvKey,
      email,
      ok: result.ok,
      authUserExists: result.authUserExists,
      authUserIdAvailable: result.authUserIdAvailable,
      authUserId: result.authUserId ?? null,
    });

    if (result.ok) {
      succeeded += 1;
      const actionLabel =
        result.action === "created"
          ? "Auth-user aangemaakt (email_confirm=true)"
          : "Auth-user bijgewerkt (wachtwoord, email_confirm)";
      console.log(
        `  [${manifestUser.id}] ${manifestUser.emailEnvKey} (${maskEmail(email)}): ${actionLabel}`,
      );
      console.log(`    ${formatAuthUserPresence(result.authUserExists, result.authUserIdAvailable)}`);
      continue;
    }

    failed += 1;
    console.log(
      `  [${manifestUser.id}] ${manifestUser.emailEnvKey} (${maskEmail(email)}): mislukt (${result.message})`,
    );
    console.log(`    ${formatAuthUserPresence(result.authUserExists, result.authUserIdAvailable)}`);
  }

  console.log("\n--- Auth-context voor profile-apply (nog niet uitgevoerd) ---");
  for (const ctx of authContexts) {
    if (!ctx.email) {
      console.log(`  [${ctx.manifestUserId}] geen e-mail in env`);
      continue;
    }
    const profileReady = ctx.ok && ctx.authUserIdAvailable ? "ja" : "nee";
    console.log(
      `  [${ctx.manifestUserId}] ${ctx.emailEnvKey} (${maskEmail(ctx.email)}): ${formatAuthUserPresence(ctx.authUserExists, ctx.authUserIdAvailable)}; klaar voor profile-apply: ${profileReady}`,
    );
  }

  console.log(`\n  Auth apply: ${succeeded} gelukt, ${failed} mislukt.`);
  console.log("  public.profiles: niet geschreven.\n");

  if (failed > 0) {
    process.exitCode = 1;
  }

  return { authContexts };
}

async function printAuthLookupStatus(manifest) {
  console.log("\n--- Auth lookup (read-only) ---");

  const adminClient = createAdminClient();

  for (const user of manifest.users) {
    const email = process.env[user.emailEnvKey]?.trim().toLowerCase() ?? "";

    if (!email) {
      console.log(`  [${user.id}] Overgeslagen: ${user.emailEnvKey} niet ingevuld.`);
      continue;
    }

    const { user: authUser, error } = await findAuthUserByEmail(adminClient, email);

    if (error) {
      console.log(
        `  [${user.id}] ${user.emailEnvKey} (${maskEmail(email)}): lookup mislukt (${error.message})`,
      );
      continue;
    }

    if (authUser) {
      console.log(`  [${user.id}] ${user.emailEnvKey} (${maskEmail(email)}): Auth-user gevonden`);
      console.log(`    ${formatAuthUserPresence(true, Boolean(authUser.id))}`);
      continue;
    }

    console.log(`  [${user.id}] ${user.emailEnvKey} (${maskEmail(email)}): Auth-user niet gevonden`);
    console.log(`    ${formatAuthUserPresence(false, false)}`);
  }
}

function validateEnvironment(manifest) {
  const errors = [];
  const warnings = [];

  for (const key of REQUIRED_GLOBAL_ENV) {
    if (!isSet(process.env[key])) {
      errors.push(`Ontbrekende omgevingsvariabele: ${key}`);
    }
  }

  const supabaseUrl = process.env.SUPABASE_URL?.trim() ?? "";
  const expectedUrl = manifest.supabaseUrlMustMatch?.trim() ?? "";

  if (expectedUrl && supabaseUrl && supabaseUrl !== expectedUrl) {
    errors.push(
      `SUPABASE_URL komt niet overeen met manifest (${expectedUrl}). Controleer js/auth.js en .env.`,
    );
  }

  for (const user of manifest.users) {
    for (const envKey of collectUserEnvKeys(user)) {
      if (!isSet(process.env[envKey])) {
        errors.push(`Ontbrekende omgevingsvariabele voor ${user.id}: ${envKey}`);
      }
    }
  }

  return { errors, warnings };
}

function printGlobalEnvStatus(manifest) {
  console.log("--- Globale omgevingsvariabelen ---");

  for (const key of REQUIRED_GLOBAL_ENV) {
    const ok = isSet(process.env[key]);
    if (key === "SUPABASE_SERVICE_ROLE_KEY") {
      console.log(`  ${key}: ${ok ? "aanwezig (waarde niet getoond)" : "ONTBREEKT"}`);
    } else {
      const value = process.env[key];
      console.log(`  ${key}: ${ok ? value.trim() : "ONTBREEKT"}`);
    }
  }

  const supabaseUrl = process.env.SUPABASE_URL?.trim() ?? "";
  const expectedUrl = manifest.supabaseUrlMustMatch?.trim() ?? "";

  if (expectedUrl && supabaseUrl && supabaseUrl === expectedUrl) {
    console.log(`  SUPABASE_URL komt overeen met manifest (${expectedUrl}).`);
  }
}

function printAllowlistStatus(manifest) {
  console.log("\n--- Allowlist (env-keys, geen wachtwoorden) ---");

  for (const user of manifest.users) {
    const keys = collectUserEnvKeys(user);
    console.log(`  [${user.id}] ${user.label}`);
    console.log(`    role=${user.role}, status=${user.status}`);
    for (const envKey of keys) {
      const ok = isSet(process.env[envKey]);
      console.log(`    ${envKey}: ${ok ? "ingevuld" : "ONTBREEKT"}`);
    }
  }
}

function printTestAddress(manifest) {
  const addr = manifest.testAddress ?? {};

  console.log("\n--- Vaste testadresvelden (manifest) ---");
  console.log(`  street: ${addr.street ?? "-"}`);
  console.log(`  house_number: ${addr.house_number ?? "-"}`);
  console.log(`  postal_code: ${addr.postal_code ?? "-"}`);
  console.log(`  city: ${addr.city ?? "-"}`);
  console.log(`  phone: ${addr.phone ?? "-"}`);
}

function printPlannedActions(manifest) {
  const addr = manifest.testAddress ?? {};

  console.log("\n--- Geplande acties (nog niet uitgevoerd) ---");

  for (const user of manifest.users) {
    const email = process.env[user.emailEnvKey]?.trim().toLowerCase() ?? "";
    const displayName = process.env[user.displayNameEnvKey]?.trim() ?? "";

    if (!email) {
      console.log(`  - [${user.id}] Overgeslagen: ${user.emailEnvKey} niet ingevuld.`);
      continue;
    }

    console.log(
      `  - [${user.id}] Zou Auth-user zoeken of aanmaken voor e-mail uit ${user.emailEnvKey} (${maskEmail(email)}).`,
    );
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
}

function printValidationResult(errors, warnings) {
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
}

async function runDryRun(manifest) {
  console.log("=== seed-test-users ===\n");
  console.log("Modus: dry-run. Er worden geen wijzigingen naar Supabase geschreven.\n");

  printGlobalEnvStatus(manifest);
  printAllowlistStatus(manifest);
  printTestAddress(manifest);
  printPlannedActions(manifest);

  const { errors, warnings } = validateEnvironment(manifest);

  console.log("\n--- Samenvatting ---");
  console.log(`  Manifest: ${MANIFEST_PATH}`);
  console.log(`  Gebruikers in allowlist: ${manifest.users.length}`);
  console.log("  Supabase-mutaties: geen (dry-run).");

  printValidationResult(errors, warnings);

  if (errors.length > 0) {
    console.log("\nDry-run afgerond met fouten. Los env-vars op vóór --apply.\n");
    process.exitCode = 1;
    return;
  }

  if (canRunAuthLookup(manifest)) {
    await printAuthLookupStatus(manifest);
  }

  console.log("\nDry-run geslaagd. Geen data geschreven naar Supabase.\n");
}

async function runApplyPrecheck(manifest) {
  console.log("=== seed-test-users ===\n");
  console.log("Modus: --apply (Auth only; geen public.profiles).\n");

  printGlobalEnvStatus(manifest);
  printAllowlistStatus(manifest);
  printTestAddress(manifest);
  printPlannedActions(manifest);

  const { errors, warnings } = validateEnvironment(manifest);

  console.log("\n--- Samenvatting ---");
  console.log(`  Manifest: ${MANIFEST_PATH}`);
  console.log(`  Gebruikers in allowlist: ${manifest.users.length}`);

  printValidationResult(errors, warnings);

  if (errors.length > 0) {
    console.log("\nApply gestopt: validatie mislukt. Los env-vars op en voer opnieuw uit.\n");
    process.exitCode = 1;
    return;
  }

  console.log("\nValidatie geslaagd.");

  if (!canRunAuthLookup(manifest)) {
    console.log("\nApply gestopt: Supabase-configuratie ontbreekt of URL komt niet overeen.\n");
    process.exitCode = 1;
    return;
  }

  await printAuthLookupStatus(manifest);
  const { authContexts } = await runApplyAuthOnly(manifest);

  if (!process.exitCode) {
    await printAuthLookupStatus(manifest);
    const profileReadyCount = authContexts.filter(
      (ctx) => ctx.ok && ctx.authUserIdAvailable && ctx.authUserId,
    ).length;
    console.log(
      `Apply (Auth) afgerond. ${profileReadyCount}/${manifest.users.length} allowlist-users hebben een Auth-user id voor profile-apply.`,
    );
    console.log("Geen public.profiles-mutaties uitgevoerd.\n");
  }
}

async function main() {
  let options;

  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
    return;
  }

  loadDotEnv(ENV_PATH);

  if (!existsSync(ENV_PATH)) {
    console.warn(`Waarschuwing: ${ENV_PATH} niet gevonden. Alleen process.env wordt gebruikt.\n`);
  }

  const manifest = loadManifest();

  if (options.mode === "apply") {
    await runApplyPrecheck(manifest);
    return;
  }

  await runDryRun(manifest);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
