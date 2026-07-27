import { readFileSync } from "node:fs";

const auditFile = process.argv[2];

if (!auditFile) {
  throw new Error(
    "Gebruik: node scripts/check-development-audit.mjs <npm-audit.json>",
  );
}

const audit = JSON.parse(
  readFileSync(auditFile, "utf8"),
);

const vulnerabilities = audit.vulnerabilities ?? {};

const allowedAdvisories = new Set([
  "GHSA-MH99-V99M-4GVG",
  "GHSA-W5HQ-G745-H8PQ",
]);

const allowedPackages = new Set([
  "@lhci/cli",
  "brace-expansion",
  "chrome-launcher",
  "glob",
  "minimatch",
  "rimraf",
  "uuid",
]);

const severityRank = {
  info: 0,
  low: 1,
  moderate: 2,
  high: 3,
  critical: 4,
};

function advisoryIdFromUrl(url) {
  const match = String(url).match(
    /GHSA-[a-z0-9-]+/i,
  );

  return match?.[0]?.toUpperCase() ?? null;
}

function resolveAdvisories(
  packageName,
  visited = new Set(),
) {
  if (visited.has(packageName)) {
    return new Set();
  }

  visited.add(packageName);

  const vulnerability =
    vulnerabilities[packageName];

  if (!vulnerability) {
    return new Set();
  }

  const result = new Set();

  for (const item of vulnerability.via ?? []) {
    if (typeof item === "string") {
      for (
        const advisory of resolveAdvisories(
          item,
          visited,
        )
      ) {
        result.add(advisory);
      }

      continue;
    }

    const advisory =
      advisoryIdFromUrl(item.url);

    if (advisory) {
      result.add(advisory);
    }
  }

  return result;
}

const accepted = [];
const blocked = [];

for (
  const [packageName, vulnerability]
  of Object.entries(vulnerabilities)
) {
  const rank =
    severityRank[vulnerability.severity] ?? 0;

  if (rank < severityRank.moderate) {
    continue;
  }

  const advisories =
    [...resolveAdvisories(packageName)];

  const isKnownException =
    allowedPackages.has(packageName) &&
    advisories.length > 0 &&
    advisories.every((advisory) =>
      allowedAdvisories.has(advisory)
    );

  const result = {
    packageName,
    severity: vulnerability.severity,
    advisories,
    isDirect: vulnerability.isDirect,
    range: vulnerability.range,
  };

  if (isKnownException) {
    accepted.push(result);
  } else if (rank >= severityRank.high) {
    blocked.push(result);
  }
}

console.log(
  "=== ONTWIKKELTOOLING AUDIT ===",
);

if (accepted.length === 0) {
  console.log(
    "Geen bekende tijdelijke uitzonderingen aangetroffen.",
  );
} else {
  console.log(
    "Tijdelijk geaccepteerde Lighthouse-CI-keten:",
  );

  for (const item of accepted) {
    console.log(
      `- ${item.packageName}: ${item.severity}; ` +
      `${item.advisories.join(", ")}`,
    );
  }
}

if (blocked.length > 0) {
  console.error(
    "\nNiet-toegestane high/critical kwetsbaarheden:",
  );

  for (const item of blocked) {
    console.error(
      `- ${item.packageName}: ${item.severity}; ` +
      `${item.advisories.join(", ") || "onbekend advisory"}`,
    );
  }

  process.exit(1);
}

console.log(
  "\nGeen onbekende high/critical " +
  "ontwikkeltoolingkwetsbaarheden gevonden.",
);

if (process.env.GITHUB_STEP_SUMMARY) {
  const summary = [
    "## Ontwikkeltooling-audit",
    "",
    "De volgende tijdelijke uitzonderingen " +
      "zijn uitsluitend toegestaan voor de " +
      "Lighthouse-CI-afhankelijkheidsketen:",
    "",
    "- `GHSA-mh99-v99m-4gvg`",
    "- `GHSA-w5hq-g745-h8pq`",
    "",
    "Alle andere high/critical bevindingen " +
      "blijven blokkerend.",
    "",
    "Herbeoordeling uiterlijk: 31-08-2026.",
    "",
  ].join("\n");

  const { appendFileSync } =
    await import("node:fs");

  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    summary,
    "utf8",
  );
}
