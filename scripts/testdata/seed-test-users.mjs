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
const ENV_PATH = join(REPO_ROOT, ".env.testdata");
const ALLOWED_TEST_SUPABASE_URL = "https://lldmyfvhjypomxfpltlx.supabase.co";

const REQUIRED_GLOBAL_ENV = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];

function parseArgs(argv) {
  const args = argv.filter((arg) => arg !== "--");

  if (args.length === 0) {
    return { mode: "dry-run" };
  }

  if (args.length === 1 && args[0] === "--dry-run") {
    return { mode: "dry-run" };
  }

  if (args.length === 1 && args[0] === "--profiles-dry-run") {
    return { mode: "profiles-dry-run" };
  }

  if (args.length === 1 && args[0] === "--profiles-apply") {
    return { mode: "profiles-apply" };
  }

  if (args.length === 1 && args[0] === "--apply") {
    return { mode: "apply" };
  }

  throw new Error(
    `Onbekende argumenten: ${args.join(" ")}. Gebruik geen args (dry-run), --dry-run, --profiles-dry-run, --profiles-apply of --apply.`,
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
    expectedUrl === ALLOWED_TEST_SUPABASE_URL &&
    supabaseUrl === ALLOWED_TEST_SUPABASE_URL &&
    supabaseUrl === expectedUrl
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

  if (expectedUrl !== ALLOWED_TEST_SUPABASE_URL) {
    errors.push(
      `Manifest verwijst niet naar het toegestane testproject (${ALLOWED_TEST_SUPABASE_URL}).`,
    );
  }

  if (supabaseUrl && supabaseUrl !== ALLOWED_TEST_SUPABASE_URL) {
    errors.push(
      `Veiligheidsblokkade: SUPABASE_URL moet exact het afgescheiden testproject zijn (${ALLOWED_TEST_SUPABASE_URL}).`,
    );
  }

  if (expectedUrl && supabaseUrl && supabaseUrl !== expectedUrl) {
    errors.push(
      `SUPABASE_URL komt niet overeen met manifest (${expectedUrl}). Controleer manifest.json en de testomgeving.`,
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
      `    Profielconfiguratie voor latere stap (nu niet uitgevoerd): full_name uit ${user.displayNameEnvKey}` +
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

function buildExpectedProfile(manifest, manifestUser, authUserId) {
  return {
    auth_user_id: authUserId,
    full_name: process.env[manifestUser.displayNameEnvKey]?.trim() ?? "",
    street: manifest.testAddress.street,
    house_number: manifest.testAddress.house_number,
    postal_code: manifest.testAddress.postal_code,
    city: manifest.testAddress.city,
    phone: manifest.testAddress.phone,
    email: process.env[manifestUser.emailEnvKey]?.trim().toLowerCase() ?? "",
    role: manifestUser.role,
    status: manifestUser.status,
  };
}

function profileMatchesExpected(profile, expected) {
  return (
    profile?.auth_user_id === expected.auth_user_id &&
    profile?.full_name === expected.full_name &&
    profile?.street === expected.street &&
    profile?.house_number === expected.house_number &&
    profile?.postal_code === expected.postal_code &&
    profile?.city === expected.city &&
    profile?.phone === expected.phone &&
    profile?.email?.toLowerCase() === expected.email &&
    profile?.role === expected.role &&
    profile?.status === expected.status
  );
}

const PROFILE_SELECT_COLUMNS =
  "id, auth_user_id, full_name, street, house_number, postal_code, city, phone, email, role, status";

async function readProfilesForExpected(adminClient, expected) {
  const { data: byAuth, error: authError } = await adminClient
    .from("profiles")
    .select(PROFILE_SELECT_COLUMNS)
    .eq("auth_user_id", expected.auth_user_id);

  if (authError) {
    return { byAuth: [], byEmail: [], error: authError };
  }

  const { data: byEmail, error: emailError } = await adminClient
    .from("profiles")
    .select(PROFILE_SELECT_COLUMNS)
    .eq("email", expected.email);

  if (emailError) {
    return { byAuth: byAuth ?? [], byEmail: [], error: emailError };
  }

  return {
    byAuth: byAuth ?? [],
    byEmail: byEmail ?? [],
    error: null,
  };
}
function classifyProfileRead(result, expected) {
  if (result.error) {
    return "error";
  }

  const byAuth = result.byAuth ?? [];
  const byEmail = result.byEmail ?? [];

  if (byAuth.length > 1 || byEmail.length > 1) {
    return "conflict";
  }

  const authProfile = byAuth[0] ?? null;
  const emailProfile = byEmail[0] ?? null;

  if (!authProfile && !emailProfile) {
    return "missing";
  }

  if (
    authProfile &&
    emailProfile &&
    authProfile.id !== emailProfile.id
  ) {
    return "conflict";
  }

  if (!authProfile && emailProfile) {
    return "conflict";
  }

  const profile = authProfile ?? emailProfile;

  return profileMatchesExpected(profile, expected)
    ? "matching"
    : "different";
}
async function runProfilesDryRun(manifest) {
  console.log("=== profiles-dry-run ===");

  const { errors, warnings } = validateEnvironment(manifest);
  printValidationResult(errors, warnings);

  if (errors.length > 0 || !canRunAuthLookup(manifest)) {
    console.log("Profiles dry-run gestopt: configuratie is niet veilig of compleet.");
    process.exitCode = 1;
    return;
  }

  const adminClient = createAdminClient();
  const counts = {
    missing: 0,
    matching: 0,
    different: 0,
    conflict: 0,
    error: 0,
    authMissing: 0,
  };

  for (const manifestUser of manifest.users) {
    const email =
      process.env[manifestUser.emailEnvKey]?.trim().toLowerCase() ?? "";

    const { user: authUser, error: authError } =
      await findAuthUserByEmail(adminClient, email);

    if (authError) {
      counts.error += 1;
      console.log(`  [${manifestUser.id}] error`);
      continue;
    }

    if (!authUser?.id) {
      counts.authMissing += 1;
      console.log(`  [${manifestUser.id}] auth-missing`);
      continue;
    }

    const expected = buildExpectedProfile(
      manifest,
      manifestUser,
      authUser.id,
    );

    const result = await readProfilesForExpected(
      adminClient,
      expected,
    );

    const status = classifyProfileRead(result, expected);
    counts[status] += 1;

    console.log(`  [${manifestUser.id}] ${status}`);
  }

  console.log("--- Samenvatting profiles-dry-run ---");
  console.log(`  missing: ${counts.missing}`);
  console.log(`  matching: ${counts.matching}`);
  console.log(`  different: ${counts.different}`);
  console.log(`  conflict: ${counts.conflict}`);
  console.log(`  error: ${counts.error}`);
  console.log(`  auth-missing: ${counts.authMissing}`);
  console.log("  profile-mutaties: 0");

  if (
    counts.conflict > 0 ||
    counts.error > 0 ||
    counts.authMissing > 0
  ) {
    process.exitCode = 1;
  }
}

async function collectProfilesApplyPlan(manifest) {
  const adminClient = createAdminClient();
  const entries = [];

  for (const manifestUser of manifest.users) {
    const email =
      process.env[manifestUser.emailEnvKey]?.trim().toLowerCase() ?? "";

    const { user: authUser, error: authError } =
      await findAuthUserByEmail(adminClient, email);

    if (authError) {
      entries.push({ manifestUser, status: "error" });
      continue;
    }

    if (!authUser?.id) {
      entries.push({ manifestUser, status: "auth-missing" });
      continue;
    }

    const expected = buildExpectedProfile(
      manifest,
      manifestUser,
      authUser.id,
    );

    const result = await readProfilesForExpected(
      adminClient,
      expected,
    );

    entries.push({
      manifestUser,
      expected,
      existingProfile: result.byAuth?.[0] ?? null,
      status: classifyProfileRead(result, expected),
    });
  }

  return { adminClient, entries };
}

async function readUnexpectedProfiles(adminClient, entries) {
  const expectedPairs = new Set(
    entries
      .filter((entry) => entry.expected)
      .map(
        (entry) =>
          `${entry.expected.auth_user_id}|${entry.expected.email}`,
      ),
  );

  const { data, error } = await adminClient
    .from("profiles")
    .select("id,auth_user_id,email");

  if (error) {
    return { total: 0, unexpected: 0, error };
  }

  const profiles = data ?? [];
  const unexpected = profiles.filter((profile) => {
    const email = profile.email?.trim().toLowerCase() ?? "";
    return !expectedPairs.has(`${profile.auth_user_id}|${email}`);
  });

  return {
    total: profiles.length,
    unexpected: unexpected.length,
    error: null,
  };
}

async function applyProfilePlanEntry(adminClient, entry) {
  if (entry.status === "matching") {
    return { ok: true, action: "unchanged" };
  }

  if (entry.status === "missing") {
    const { data, error } = await adminClient
      .from("profiles")
      .insert(entry.expected)
      .select("id")
      .single();

    return {
      ok: !error && Boolean(data?.id),
      action: "created",
    };
  }

  if (entry.status === "different" && entry.existingProfile?.id) {
    const { data, error } = await adminClient
      .from("profiles")
      .update(entry.expected)
      .eq("id", entry.existingProfile.id)
      .select("id")
      .single();

    return {
      ok: !error && data?.id === entry.existingProfile.id,
      action: "updated",
    };
  }

  return { ok: false, action: "blocked" };
}

async function runProfilesApply(manifest) {
  console.log("=== profiles-apply ===");

  const { errors, warnings } = validateEnvironment(manifest);
  printValidationResult(errors, warnings);

  if (errors.length > 0 || !canRunAuthLookup(manifest)) {
    console.log("Profiles apply gestopt: configuratie is niet veilig of compleet.");
    process.exitCode = 1;
    return;
  }

  const { adminClient, entries } =
    await collectProfilesApplyPlan(manifest);

  const blockedStatuses = new Set([
    "conflict",
    "error",
    "auth-missing",
  ]);

  for (const entry of entries) {
    console.log(`  [${entry.manifestUser.id}] ${entry.status}`);
  }

  if (
    entries.length !== manifest.users.length ||
    entries.some((entry) => blockedStatuses.has(entry.status))
  ) {
    console.log("Profiles apply geblokkeerd door de voorcontrole.");
    process.exitCode = 1;
    return;
  }

  const existingCheck =
    await readUnexpectedProfiles(adminClient, entries);

  if (existingCheck.error || existingCheck.unexpected > 0) {
    console.log(
      `Profiles apply geblokkeerd: onverwachte profielen: ${existingCheck.unexpected}.`,
    );
    process.exitCode = 1;
    return;
  }

  const mutations = {
    created: 0,
    updated: 0,
    unchanged: 0,
    failed: 0,
  };

  for (const entry of entries) {
    const result =
      await applyProfilePlanEntry(adminClient, entry);

    if (!result.ok) {
      mutations.failed += 1;
      console.log(`  [${entry.manifestUser.id}] mislukt`);
      break;
    }

    mutations[result.action] += 1;
    console.log(
      `  [${entry.manifestUser.id}] ${result.action}`,
    );
  }

  console.log("--- Profielmutaties ---");
  console.log(`  aangemaakt: ${mutations.created}`);
  console.log(`  bijgewerkt: ${mutations.updated}`);
  console.log(`  ongewijzigd: ${mutations.unchanged}`);
  console.log(`  mislukt: ${mutations.failed}`);

  if (mutations.failed > 0) {
    process.exitCode = 1;
    return;
  }

  const verification =
    await collectProfilesApplyPlan(manifest);

  const finalCheck = await readUnexpectedProfiles(
    verification.adminClient,
    verification.entries,
  );

  const matchingCount = verification.entries.filter(
    (entry) => entry.status === "matching",
  ).length;

  console.log("--- Eindcontrole ---");
  console.log(`  matching: ${matchingCount}`);
  console.log(`  totaal profiles: ${finalCheck.total}`);
  console.log(`  onverwachte profiles: ${finalCheck.unexpected}`);

  if (
    finalCheck.error ||
    finalCheck.unexpected !== 0 ||
    finalCheck.total !== manifest.users.length ||
    matchingCount !== manifest.users.length
  ) {
    console.log("Profiles apply eindcontrole mislukt.");
    process.exitCode = 1;
    return;
  }

  console.log("Profiles apply geslaagd.");
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

  if (options.mode === "profiles-apply") {
    await runProfilesApply(manifest);
    return;
  }

  if (options.mode === "profiles-dry-run") {
    await runProfilesDryRun(manifest);
    return;
  }

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
