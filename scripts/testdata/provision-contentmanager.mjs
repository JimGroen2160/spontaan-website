#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");
const MANIFEST_PATH = join(__dirname, "manifest.json");
const ENV_PATH = join(REPO_ROOT, ".env.testdata");

const ALLOWED_TEST_URL = "https://lldmyfvhjypomxfpltlx.supabase.co";
const TARGET_USER_ID = "test-contentmanager";

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

function requireValue(name) {
  const value = process.env[name]?.trim() ?? "";

  if (!value) {
    throw new Error(`Ontbrekende omgevingsvariabele: ${name}`);
  }

  return value;
}

function maskEmail(email) {
  const at = email.indexOf("@");

  if (at <= 1) {
    return "(ingevuld)";
  }

  return `${email.slice(0, 1)}***${email.slice(at)}`;
}

function parseMode(argv) {
  if (argv.length === 0 || (argv.length === 1 && argv[0] === "--dry-run")) {
    return "dry-run";
  }

  if (argv.length === 1 && argv[0] === "--apply-contentmanager") {
    return "apply";
  }

  throw new Error(
    "Gebruik zonder argumenten/--dry-run of expliciet --apply-contentmanager.",
  );
}

async function findAuthUserByEmail(adminClient, email) {
  const target = email.toLowerCase();
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw error;
    }

    const users = data?.users ?? [];
    const match = users.find(
      (candidate) => candidate.email?.toLowerCase() === target,
    );

    if (match) {
      return match;
    }

    if (users.length < perPage) {
      return null;
    }

    page += 1;
  }
}

async function readProfiles(adminClient, authUserId, email) {
  const columns =
    "id,auth_user_id,full_name,street,house_number,postal_code,city,phone,email,role,status";

  const { data: byEmail, error: emailError } = await adminClient
    .from("profiles")
    .select(columns)
    .eq("email", email);

  if (emailError) {
    throw emailError;
  }

  let byAuth = [];

  if (authUserId) {
    const { data, error } = await adminClient
      .from("profiles")
      .select(columns)
      .eq("auth_user_id", authUserId);

    if (error) {
      throw error;
    }

    byAuth = data ?? [];
  }

  return {
    byEmail: byEmail ?? [],
    byAuth,
  };
}

function buildExpectedProfile(manifest, target, authUserId, email, displayName) {
  return {
    auth_user_id: authUserId,
    full_name: displayName,
    street: manifest.testAddress.street,
    house_number: manifest.testAddress.house_number,
    postal_code: manifest.testAddress.postal_code,
    city: manifest.testAddress.city,
    phone: manifest.testAddress.phone,
    email,
    role: target.role,
    status: target.status,
  };
}

function profileMatches(profile, expected) {
  return (
    profile.auth_user_id === expected.auth_user_id &&
    profile.full_name === expected.full_name &&
    profile.street === expected.street &&
    profile.house_number === expected.house_number &&
    profile.postal_code === expected.postal_code &&
    profile.city === expected.city &&
    profile.phone === expected.phone &&
    profile.email?.toLowerCase() === expected.email &&
    profile.role === expected.role &&
    profile.status === expected.status
  );
}

function classifyProfiles(result, expected) {
  if (result.byEmail.length > 1 || result.byAuth.length > 1) {
    return { state: "conflict", profile: null };
  }

  const emailProfile = result.byEmail[0] ?? null;
  const authProfile = result.byAuth[0] ?? null;

  if (
    emailProfile &&
    authProfile &&
    emailProfile.id !== authProfile.id
  ) {
    return { state: "conflict", profile: null };
  }

  const profile = authProfile ?? emailProfile;

  if (!profile) {
    return { state: "missing", profile: null };
  }

  if (!expected) {
    return { state: "conflict", profile };
  }

  return {
    state: profileMatches(profile, expected) ? "matching" : "different",
    profile,
  };
}

async function main() {
  const mode = parseMode(process.argv.slice(2));

  loadDotEnv(ENV_PATH);

  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  const target = manifest.users.find((user) => user.id === TARGET_USER_ID);

  if (!target) {
    throw new Error(`Manifest-entry ${TARGET_USER_ID} ontbreekt.`);
  }

  if (target.role !== "contentmanager" || target.status !== "active") {
    throw new Error(
      "STOP: test-contentmanager heeft niet exact role=contentmanager/status=active.",
    );
  }

  if (manifest.supabaseUrlMustMatch !== ALLOWED_TEST_URL) {
    throw new Error("STOP: manifest wijst niet naar het vaste TEST-project.");
  }

  const supabaseUrl = requireValue("SUPABASE_URL");
  const serviceRoleKey = requireValue("SUPABASE_SERVICE_ROLE_KEY");
  const email = requireValue(target.emailEnvKey).toLowerCase();
  const password = requireValue(target.passwordEnvKey);
  const displayName = requireValue(target.displayNameEnvKey);

  if (supabaseUrl !== ALLOWED_TEST_URL) {
    throw new Error(
      `STOP: SUPABASE_URL moet exact ${ALLOWED_TEST_URL} zijn.`,
    );
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log("=== provision-contentmanager ===");
  console.log(`Modus: ${mode}`);
  console.log(`Doel: ${TARGET_USER_ID}`);
  console.log(`E-mail: ${maskEmail(email)}`);
  console.log(`Rol/status: ${target.role}/${target.status}`);
  console.log(`Supabase TEST: ${supabaseUrl}`);

  let authUser = await findAuthUserByEmail(adminClient, email);

  console.log(
    `Auth-user bestaat vóór actie: ${authUser?.id ? "ja" : "nee"}`,
  );

  let expected = authUser?.id
    ? buildExpectedProfile(
        manifest,
        target,
        authUser.id,
        email,
        displayName,
      )
    : null;

  let profileRead = await readProfiles(
    adminClient,
    authUser?.id ?? null,
    email,
  );

  let classification = classifyProfiles(profileRead, expected);

  console.log(`Profile-status vóór actie: ${classification.state}`);

  if (classification.state === "conflict") {
    throw new Error(
      "STOP: profile-conflict gevonden. Geen write toegestaan.",
    );
  }

  if (classification.state === "different") {
    throw new Error(
      "STOP: bestaand contentmanager-profiel wijkt af. Geen automatische wijziging toegestaan.",
    );
  }

  if (mode === "dry-run") {
    console.log(
      `Geplande Auth-actie: ${authUser ? "geen" : "contentmanager aanmaken"}`,
    );
    console.log(
      `Geplande profile-actie: ${
        authUser && classification.state === "matching"
          ? "geen"
          : "contentmanager-profiel aanmaken"
      }`,
    );
    console.log("Supabase-mutaties: 0");
    console.log("Dry-run geslaagd.");
    return;
  }

  if (!authUser) {
    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error || !data?.user?.id) {
      throw new Error(
        `Auth-user aanmaken mislukt: ${error?.message ?? "onbekende fout"}`,
      );
    }

    authUser = data.user;
    console.log("Auth-user aangemaakt.");
  } else {
    console.log(
      "Bestaande Auth-user ongewijzigd gelaten; wachtwoord is niet gereset.",
    );
  }

  expected = buildExpectedProfile(
    manifest,
    target,
    authUser.id,
    email,
    displayName,
  );

  profileRead = await readProfiles(adminClient, authUser.id, email);
  classification = classifyProfiles(profileRead, expected);

  if (classification.state === "different") {
    throw new Error(
      "STOP: bestaand profiel wijkt af na Auth-controle. Geen update toegestaan.",
    );
  }

  if (classification.state === "conflict") {
    throw new Error(
      "STOP: profile-conflict na Auth-controle. Geen write toegestaan.",
    );
  }

  if (classification.state === "missing") {
    const { data, error } = await adminClient
      .from("profiles")
      .insert(expected)
      .select("id")
      .single();

    if (error || !data?.id) {
      throw new Error(
        `Contentmanager-profiel aanmaken mislukt: ${error?.message ?? "onbekende fout"}`,
      );
    }

    console.log("Contentmanager-profiel aangemaakt.");
  } else {
    console.log("Bestaand contentmanager-profiel is al exact matching.");
  }

  const finalRead = await readProfiles(adminClient, authUser.id, email);
  const finalState = classifyProfiles(finalRead, expected);

  if (finalState.state !== "matching") {
    throw new Error(
      `Eindcontrole mislukt: profile-status=${finalState.state}`,
    );
  }

  console.log("Eindcontrole: contentmanager Auth-user aanwezig.");
  console.log("Eindcontrole: contentmanager-profiel exact matching.");
  console.log("Gerichte provisioning geslaagd.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});