import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const RBAC_MIGRATION =
  new URL(
    "../supabase/migrations/20260810181000_contentmanager_rbac.sql",
    import.meta.url,
  );

const GRANT_MIGRATION =
  new URL(
    "../supabase/migrations/20260815152500_service_role_manager_function_grants.sql",
    import.meta.url,
  );

function normalizeSql(value) {
  return value
    .replace(/--.*$/gm, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

test(
  "profiles UPDATE-trigger gebruikt beide beheerhelpers",
  async () => {
    const sql =
      normalizeSql(
        await readFile(
          RBAC_MIGRATION,
          "utf8",
        ),
      );

    assert.match(
      sql,
      /create trigger protect_contentmanager_profile_update/,
    );

    assert.match(
      sql,
      /public\.is_current_user_manager\(\)/,
    );

    assert.match(
      sql,
      /public\.is_current_user_admin\(\)/,
    );
  },
);

test(
  "service_role krijgt EXECUTE op beide triggerafhankelijkheden",
  async () => {
    const sql =
      normalizeSql(
        await readFile(
          GRANT_MIGRATION,
          "utf8",
        ),
      );

    assert.match(
      sql,
      /grant execute on function public\.is_current_user_manager\(\) to service_role;/,
    );

    assert.match(
      sql,
      /grant execute on function public\.is_current_user_admin\(\) to service_role;/,
    );
  },
);

test(
  "correctiemigratie verbreedt geen functionrechten naar andere rollen",
  async () => {
    const sql =
      normalizeSql(
        await readFile(
          GRANT_MIGRATION,
          "utf8",
        ),
      );

    const grantStatements =
      sql.match(
        /grant execute on function [^;]+;/g,
      ) ?? [];

    assert.equal(
      grantStatements.length,
      2,
      "Correctiemigratie moet exact twee EXECUTE-grants bevatten.",
    );

    for (const grant of grantStatements) {
      assert.match(
        grant,
        /to service_role;$/,
      );

      assert.doesNotMatch(
        grant,
        /\bto (public|anon|authenticated)\b/,
      );
    }
  },
);
