import fs from "node:fs";
import path from "node:path";

const resultsDir = process.argv[2];

if (!resultsDir) {
  console.error("Usage: node compare-lighthouse-results.mjs <results-dir>");
  process.exit(2);
}

const versions = {
  lh12: "12.6.1",
  lh13: "13.4.1",
};

const pages = {
  home: {
    url: "http://localhost:5500/",
    thresholds: {
      performance: { type: "minScore", value: 0.6 },
      accessibility: { type: "minScore", value: 0.8 },
      seo: { type: "minScore", value: 0.8 },
    },
  },
  media: {
    url: "http://localhost:5500/pages/media.html",
    thresholds: {
      performance: { type: "minScore", value: 0.6 },
      accessibility: { type: "minScore", value: 0.8 },
      seo: { type: "minScore", value: 0.8 },
    },
  },
  repertoire: {
    url: "http://localhost:5500/pages/repertoire.html",
    thresholds: {
      performance: { type: "minScore", value: 0.6 },
      accessibility: { type: "minScore", value: 0.8 },
      seo: { type: "minScore", value: 0.8 },
      "cumulative-layout-shift": {
        type: "maxNumericValue",
        value: 0.1,
      },
    },
  },
};

const runNumbers = [1, 2, 3];
const errors = [];
const records = [];

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    errors.push(
      `Kan JSON niet lezen: ${filePath}: ${error.message}`,
    );
    return null;
  }
}

function normalizedUrl(value) {
  try {
    const parsed = new URL(value);
    return (
      `${parsed.protocol}//${parsed.host}` +
      `${parsed.pathname}${parsed.search}`
    );
  } catch {
    return null;
  }
}

function categoryRefSignature(lhr, categoryId) {
  const category = lhr?.categories?.[categoryId];

  if (!category || !Array.isArray(category.auditRefs)) {
    return null;
  }

  return category.auditRefs
    .map((ref) => ({
      id: ref.id,
      weight: ref.weight,
      group: ref.group ?? null,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function stableJson(value) {
  return JSON.stringify(value);
}

for (
  const [versionKey, expectedVersion]
  of Object.entries(versions)
) {
  for (
    const [pageKey, page]
    of Object.entries(pages)
  ) {
    for (const run of runNumbers) {
      const base = path.join(
        resultsDir,
        versionKey,
        pageKey,
        `run-${run}`,
      );

      const jsonPath = `${base}.report.json`;
      const htmlPath = `${base}.report.html`;

      if (!fs.existsSync(jsonPath)) {
        errors.push(`Ontbrekend JSON-rapport: ${jsonPath}`);
        continue;
      }

      if (
        !fs.existsSync(htmlPath) ||
        fs.statSync(htmlPath).size === 0
      ) {
        errors.push(
          `Ontbrekend of leeg HTML-rapport: ${htmlPath}`,
        );
      }

      const lhr = readJson(jsonPath);

      if (!lhr) {
        continue;
      }

      if (lhr.lighthouseVersion !== expectedVersion) {
        errors.push(
          `${versionKey}/${pageKey}/run-${run}: ` +
          `Lighthouse-versie ${lhr.lighthouseVersion} ` +
          `!= ${expectedVersion}`,
        );
      }

      if (lhr.runtimeError) {
        errors.push(
          `${versionKey}/${pageKey}/run-${run}: runtimeError: ` +
          `${JSON.stringify(lhr.runtimeError)}`,
        );
      }

      const warnings = Array.isArray(lhr.runWarnings)
        ? lhr.runWarnings
        : [];

      if (warnings.length > 0) {
        errors.push(
          `${versionKey}/${pageKey}/run-${run}: runWarnings: ` +
          `${JSON.stringify(warnings)}`,
        );
      }

      const requested =
        normalizedUrl(lhr.requestedUrl);

      const expectedRequested =
        normalizedUrl(page.url);

      if (requested !== expectedRequested) {
        errors.push(
          `${versionKey}/${pageKey}/run-${run}: ` +
          `requestedUrl ${requested} != ${expectedRequested}`,
        );
      }

      const finalUrl =
        normalizedUrl(lhr.finalDisplayedUrl) ??
        normalizedUrl(lhr.finalUrl) ??
        normalizedUrl(lhr.mainDocumentUrl);

      if (finalUrl !== expectedRequested) {
        errors.push(
          `${versionKey}/${pageKey}/run-${run}: ` +
          `final URL ${finalUrl} != ${expectedRequested}`,
        );
      }

      const scores = {};

      for (
        const categoryId of [
          "performance",
          "accessibility",
          "seo",
        ]
      ) {
        const score =
          lhr?.categories?.[categoryId]?.score;

        if (!isFiniteNumber(score)) {
          errors.push(
            `${versionKey}/${pageKey}/run-${run}: ` +
            `ongeldige of ontbrekende ${categoryId}-score`,
          );
        } else {
          scores[categoryId] = score;
        }
      }

      const cls =
        lhr
          ?.audits
          ?.["cumulative-layout-shift"]
          ?.numericValue;

      if (
        pageKey === "repertoire" &&
        !isFiniteNumber(cls)
      ) {
        errors.push(
          `${versionKey}/${pageKey}/run-${run}: ` +
          "ongeldige of ontbrekende " +
          "cumulative-layout-shift.numericValue",
        );
      }

      const auditIds =
        Object.keys(lhr.audits ?? {}).sort();

      if (auditIds.length === 0) {
        errors.push(
          `${versionKey}/${pageKey}/run-${run}: ` +
          "geen audits aanwezig",
        );
      }

      const categoryRefs = {};

      for (
        const categoryId of [
          "performance",
          "accessibility",
          "seo",
        ]
      ) {
        const signature =
          categoryRefSignature(
            lhr,
            categoryId,
          );

        if (!signature) {
          errors.push(
            `${versionKey}/${pageKey}/run-${run}: ` +
            `category auditRefs ontbreken voor ${categoryId}`,
          );
        }

        categoryRefs[categoryId] =
          signature ?? [];
      }

      records.push({
        versionKey,
        lighthouseVersion: lhr.lighthouseVersion,
        pageKey,
        run,
        requestedUrl: lhr.requestedUrl,
        finalUrl:
          lhr.finalDisplayedUrl ??
          lhr.finalUrl ??
          lhr.mainDocumentUrl ??
          null,
        fetchTime: lhr.fetchTime ?? null,
        userAgent: lhr.userAgent ?? null,
        benchmarkIndex:
          lhr?.environment?.benchmarkIndex ?? null,
        timingTotal:
          isFiniteNumber(lhr?.timing?.total)
            ? lhr.timing.total
            : null,
        scores,
        cls:
          isFiniteNumber(cls)
            ? cls
            : null,
        auditIds,
        categoryRefs,
        warnings,
      });
    }
  }
}

for (const versionKey of Object.keys(versions)) {
  for (const pageKey of Object.keys(pages)) {
    const pageRecords = records
      .filter(
        (record) =>
          record.versionKey === versionKey &&
          record.pageKey === pageKey,
      )
      .sort((a, b) => a.run - b.run);

    if (pageRecords.length !== 3) {
      errors.push(
        `${versionKey}/${pageKey}: ` +
        `verwacht 3 geldige JSON-runs, ` +
        `kreeg ${pageRecords.length}`,
      );

      continue;
    }

    const baselineAudits =
      stableJson(pageRecords[0].auditIds);

    for (const record of pageRecords.slice(1)) {
      if (
        stableJson(record.auditIds) !==
        baselineAudits
      ) {
        errors.push(
          `${versionKey}/${pageKey}: ` +
          "auditset verschilt tussen runs",
        );
      }
    }

    for (
      const categoryId of [
        "performance",
        "accessibility",
        "seo",
      ]
    ) {
      const baselineRefs =
        stableJson(
          pageRecords[0]
            .categoryRefs[categoryId],
        );

      for (
        const record of pageRecords.slice(1)
      ) {
        if (
          stableJson(
            record.categoryRefs[categoryId],
          ) !== baselineRefs
        ) {
          errors.push(
            `${versionKey}/${pageKey}: ` +
            `auditRefs/weights voor ${categoryId} ` +
            "verschillen tussen runs",
          );
        }
      }
    }
  }
}

const userAgents = [
  ...new Set(
    records
      .map((record) => record.userAgent)
      .filter(Boolean),
  ),
];

if (userAgents.length !== 1) {
  errors.push(
    "Verwacht exact 1 Chrome userAgent over alle runs, " +
    `kreeg ${userAgents.length}`,
  );
}

const environmentPath =
  path.join(
    resultsDir,
    "environment.json",
  );

const environment =
  fs.existsSync(environmentPath)
    ? readJson(environmentPath)
    : null;

if (!environment) {
  errors.push(
    `Ontbrekende environment.json: ${environmentPath}`,
  );
} else {
  if (environment.node !== "v24.18.0") {
    errors.push(
      `Node-contract wijkt af: ${environment.node}`,
    );
  }

  if (environment.npm !== "11.16.0") {
    errors.push(
      `npm-contract wijkt af: ${environment.npm}`,
    );
  }

  if (
    environment.lh12 !== "12.6.1" ||
    environment.lh13 !== "13.4.1"
  ) {
    errors.push(
      "Lighthouse-toolcontract wijkt af: " +
      `lh12=${environment.lh12}, ` +
      `lh13=${environment.lh13}`,
    );
  }

  if (
    environment.chromeFlags !==
    "--no-sandbox --disable-dev-shm-usage --headless=new"
  ) {
    errors.push(
      "Chrome-flagscontract wijkt af: " +
      environment.chromeFlags,
    );
  }

  if (
    !environment.chromePath ||
    !environment.chromeVersion
  ) {
    errors.push(
      "Chrome-pad of Chrome-versie ontbreekt " +
      "in environment.json",
    );
  }
}

const orderPath =
  path.join(
    resultsDir,
    "run-order.tsv",
  );

let runOrder = [];

const expectedOrder = [];

for (const pageKey of Object.keys(pages)) {
  expectedOrder.push(
    ["lh12", pageKey, "1"],
    ["lh13", pageKey, "1"],
    ["lh13", pageKey, "2"],
    ["lh12", pageKey, "2"],
    ["lh12", pageKey, "3"],
    ["lh13", pageKey, "3"],
  );
}

if (!fs.existsSync(orderPath)) {
  errors.push(
    `Ontbrekende run-order.tsv: ${orderPath}`,
  );
} else {
  runOrder = fs
    .readFileSync(orderPath, "utf8")
    .trim()
    .split(/\r?\n/)
    .filter(Boolean);

  if (runOrder.length !== 18) {
    errors.push(
      `run-order.tsv bevat ${runOrder.length} regels; ` +
      "verwacht 18",
    );
  }

  if (runOrder.length === 18) {
    for (
      let index = 0;
      index < expectedOrder.length;
      index += 1
    ) {
      const columns =
        runOrder[index].split("\t");

      const actualTuple = [
        columns[1] ?? "",
        columns[2] ?? "",
        columns[3] ?? "",
      ];

      const expectedTuple =
        expectedOrder[index];

      if (
        stableJson(actualTuple) !==
        stableJson(expectedTuple)
      ) {
        errors.push(
          `run-order regel ${index + 1} wijkt af: ` +
          `${stableJson(actualTuple)} != ` +
          `${stableJson(expectedTuple)}`,
        );
      }
    }
  }
}

const summaries = {};

for (const versionKey of Object.keys(versions)) {
  summaries[versionKey] = {};

  for (
    const [pageKey, page]
    of Object.entries(pages)
  ) {
    const pageRecords = records
      .filter(
        (record) =>
          record.versionKey === versionKey &&
          record.pageKey === pageKey,
      )
      .sort((a, b) => a.run - b.run);

    const categorySummary = {};

    for (
      const categoryId of [
        "performance",
        "accessibility",
        "seo",
      ]
    ) {
      const values = pageRecords
        .map(
          (record) =>
            record.scores[categoryId],
        )
        .filter(isFiniteNumber);

      categorySummary[categoryId] = {
        runs: values,
        optimistic:
          values.length === 3
            ? Math.max(...values)
            : null,
        median:
          values.length === 3
            ? median(values)
            : null,
      };
    }

    const clsValues = pageRecords
      .map((record) => record.cls)
      .filter(isFiniteNumber);

    const thresholdResults = [];

    for (
      const [metricId, threshold]
      of Object.entries(page.thresholds)
    ) {
      let observed = null;

      if (threshold.type === "minScore") {
        observed =
          categorySummary
            [metricId]
            ?.optimistic ??
          null;
      } else if (
        threshold.type ===
        "maxNumericValue"
      ) {
        observed =
          clsValues.length === 3
            ? Math.min(...clsValues)
            : null;
      }

      let passed = false;

      if (isFiniteNumber(observed)) {
        passed =
          threshold.type === "minScore"
            ? observed >= threshold.value
            : observed <= threshold.value;
      }

      if (!passed) {
        errors.push(
          `${versionKey}/${pageKey}: ` +
          `threshold ${metricId} niet gehaald; ` +
          `observed=${observed}, ` +
          `contract=${threshold.type} ` +
          `${threshold.value}`,
        );
      }

      thresholdResults.push({
        metricId,
        type: threshold.type,
        contract: threshold.value,
        observed,
        passed,
      });
    }

    summaries[versionKey][pageKey] = {
      categories: categorySummary,
      cls: {
        runs: clsValues,
        optimistic:
          clsValues.length === 3
            ? Math.min(...clsValues)
            : null,
        median:
          clsValues.length === 3
            ? median(clsValues)
            : null,
      },
      thresholds: thresholdResults,
    };
  }
}

const comparisons = {};

for (const pageKey of Object.keys(pages)) {
  const lh12Record = records.find(
    (record) =>
      record.versionKey === "lh12" &&
      record.pageKey === pageKey &&
      record.run === 1,
  );

  const lh13Record = records.find(
    (record) =>
      record.versionKey === "lh13" &&
      record.pageKey === pageKey &&
      record.run === 1,
  );

  if (!lh12Record || !lh13Record) {
    continue;
  }

  const lh12AuditSet =
    new Set(lh12Record.auditIds);

  const lh13AuditSet =
    new Set(lh13Record.auditIds);

  const addedAudits = [
    ...lh13AuditSet,
  ]
    .filter(
      (id) => !lh12AuditSet.has(id),
    )
    .sort();

  const removedAudits = [
    ...lh12AuditSet,
  ]
    .filter(
      (id) => !lh13AuditSet.has(id),
    )
    .sort();

  const categoryWeightDiffs = {};

  for (
    const categoryId of [
      "performance",
      "accessibility",
      "seo",
    ]
  ) {
    const oldRefs = new Map(
      lh12Record
        .categoryRefs[categoryId]
        .map(
          (ref) => [ref.id, ref],
        ),
    );

    const newRefs = new Map(
      lh13Record
        .categoryRefs[categoryId]
        .map(
          (ref) => [ref.id, ref],
        ),
    );

    const ids = [
      ...new Set([
        ...oldRefs.keys(),
        ...newRefs.keys(),
      ]),
    ].sort();

    const diffs = [];

    for (const id of ids) {
      const oldRef = oldRefs.get(id);
      const newRef = newRefs.get(id);

      const oldWeight =
        oldRef?.weight ?? null;

      const newWeight =
        newRef?.weight ?? null;

      const oldGroup =
        oldRef?.group ?? null;

      const newGroup =
        newRef?.group ?? null;

      if (
        oldWeight !== newWeight ||
        oldGroup !== newGroup
      ) {
        diffs.push({
          id,
          oldWeight,
          newWeight,
          oldGroup,
          newGroup,
        });
      }
    }

    categoryWeightDiffs[categoryId] =
      diffs;
  }

  const scoreDeltas = {};

  for (
    const categoryId of [
      "performance",
      "accessibility",
      "seo",
    ]
  ) {
    const oldOptimistic =
      summaries
        .lh12
        ?.[pageKey]
        ?.categories
        ?.[categoryId]
        ?.optimistic;

    const newOptimistic =
      summaries
        .lh13
        ?.[pageKey]
        ?.categories
        ?.[categoryId]
        ?.optimistic;

    const oldMedian =
      summaries
        .lh12
        ?.[pageKey]
        ?.categories
        ?.[categoryId]
        ?.median;

    const newMedian =
      summaries
        .lh13
        ?.[pageKey]
        ?.categories
        ?.[categoryId]
        ?.median;

    scoreDeltas[categoryId] = {
      optimistic:
        isFiniteNumber(oldOptimistic) &&
        isFiniteNumber(newOptimistic)
          ? newOptimistic -
            oldOptimistic
          : null,
      median:
        isFiniteNumber(oldMedian) &&
        isFiniteNumber(newMedian)
          ? newMedian -
            oldMedian
          : null,
    };
  }

  const oldCls =
    summaries
      .lh12
      ?.[pageKey]
      ?.cls
      ?.optimistic;

  const newCls =
    summaries
      .lh13
      ?.[pageKey]
      ?.cls
      ?.optimistic;

  comparisons[pageKey] = {
    addedAudits,
    removedAudits,
    categoryWeightDiffs,
    scoreDeltas,
    clsOptimisticDelta:
      isFiniteNumber(oldCls) &&
      isFiniteNumber(newCls)
        ? newCls - oldCls
        : null,
  };
}

const result = {
  status:
    errors.length === 0
      ? "STRUCTURAL_GATES_PASSED_MANUAL_DELTA_REVIEW_REQUIRED"
      : "STOP",
  environment,
  userAgent:
    userAgents.length === 1
      ? userAgents[0]
      : userAgents,
  runOrder,
  summaries,
  comparisons,
  errors,
};

fs.mkdirSync(
  resultsDir,
  { recursive: true },
);

fs.writeFileSync(
  path.join(
    resultsDir,
    "comparison.json",
  ),
  `${JSON.stringify(result, null, 2)}\n`,
  "utf8",
);

const md = [];

md.push(
  "# Lighthouse 12.6.1 versus 13.4.1 — PoC-3",
);
md.push("");
md.push(`Status: **${result.status}**`);
md.push("");
md.push("## Omgeving");
md.push("");
md.push(
  `- Node: ${environment?.node ?? "onbekend"}`,
);
md.push(
  `- npm: ${environment?.npm ?? "onbekend"}`,
);
md.push(
  `- Chrome: ${environment?.chromeVersion ?? "onbekend"}`,
);
md.push(
  `- Chrome-pad: ${environment?.chromePath ?? "onbekend"}`,
);
md.push(
  `- Chrome-flags: ` +
  `${environment?.chromeFlags ?? "onbekend"}`,
);
md.push("");

for (const pageKey of Object.keys(pages)) {
  md.push(`## ${pageKey}`);
  md.push("");

  md.push(
    "| Versie | Performance opt/median | " +
    "Accessibility opt/median | " +
    "SEO opt/median | CLS opt/median |",
  );

  md.push(
    "|---|---:|---:|---:|---:|",
  );

  for (
    const versionKey of Object.keys(versions)
  ) {
    const pageSummary =
      summaries[versionKey]?.[pageKey];

    const format = (value) =>
      isFiniteNumber(value)
        ? value.toFixed(4)
        : "n/a";

    md.push(
      `| ${versions[versionKey]} | ` +
      `${format(
        pageSummary
          ?.categories
          ?.performance
          ?.optimistic,
      )} / ` +
      `${format(
        pageSummary
          ?.categories
          ?.performance
          ?.median,
      )} | ` +
      `${format(
        pageSummary
          ?.categories
          ?.accessibility
          ?.optimistic,
      )} / ` +
      `${format(
        pageSummary
          ?.categories
          ?.accessibility
          ?.median,
      )} | ` +
      `${format(
        pageSummary
          ?.categories
          ?.seo
          ?.optimistic,
      )} / ` +
      `${format(
        pageSummary
          ?.categories
          ?.seo
          ?.median,
      )} | ` +
      `${format(
        pageSummary?.cls?.optimistic,
      )} / ` +
      `${format(
        pageSummary?.cls?.median,
      )} |`,
    );
  }

  const comparison =
    comparisons[pageKey];

  md.push("");

  md.push(
    "- Toegevoegde audits in LH13: " +
    `${comparison?.addedAudits?.length ?? 0}`,
  );

  md.push(
    "- Verwijderde audits in LH13: " +
    `${comparison?.removedAudits?.length ?? 0}`,
  );

  md.push(
    "- Gewijzigde performance auditRefs/weights: " +
    `${comparison
      ?.categoryWeightDiffs
      ?.performance
      ?.length ?? 0}`,
  );

  md.push(
    "- Gewijzigde accessibility auditRefs/weights: " +
    `${comparison
      ?.categoryWeightDiffs
      ?.accessibility
      ?.length ?? 0}`,
  );

  md.push(
    "- Gewijzigde SEO auditRefs/weights: " +
    `${comparison
      ?.categoryWeightDiffs
      ?.seo
      ?.length ?? 0}`,
  );

  md.push("");
}

if (errors.length > 0) {
  md.push("## Fouten / STOP-redenen");
  md.push("");

  for (const error of errors) {
    md.push(`- ${error}`);
  }

  md.push("");
} else {
  md.push("## Vervolg");
  md.push("");

  md.push(
    "Alle structurele, runtime- en thresholdgates " +
    "zijn geslaagd. Score-, audit- en " +
    "weightverschillen moeten nog handmatig worden " +
    "verklaard voordat PoC-3 definitief GO kan krijgen.",
  );

  md.push("");
}

fs.writeFileSync(
  path.join(
    resultsDir,
    "comparison.md",
  ),
  `${md.join("\n")}\n`,
  "utf8",
);

console.log(md.join("\n"));

if (errors.length > 0) {
  process.exit(1);
}
