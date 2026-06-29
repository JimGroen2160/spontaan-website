(function () {
  "use strict";

  const DATA_URL = "../data/rapportage-demo.json";
  const SCORE_METRICS = ["performance", "accessibility", "bestPractices", "seo"];
  const SCORE_TARGET = 90;
  let rapportageData = null;

  const labels = {
    performance: "Snelheid",
    accessibility: "Toegankelijkheid",
    bestPractices: "Beste praktijken",
    seo: "SEO",
  };

  const actions = {
    performance: "Controleer grote afbeeldingen en onnodig zware pagina-inhoud.",
    accessibility: "Controleer toetsenbordbediening, contrast en ondersteuning voor schermlezers.",
    bestPractices: "Update afhankelijke onderdelen en verwijder onveilige of verouderde code.",
    seo: "Verbeter paginatitels, metabeschrijvingen en interne links.",
  };

  function getElement(id) {
    return document.getElementById(id);
  }

  function isValidScore(value) {
    return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
  }

  function getStatus(score) {
    if (!isValidScore(score)) return { code: "no-data", label: "Geen gegevens" };
    if (score >= SCORE_TARGET) return { code: "good", label: "Boven streefwaarde (90)" };
    if (score >= 75) return { code: "attention", label: "Onder streefwaarde (90)" };
    return { code: "action", label: "Actie aanbevolen" };
  }

  function getGeneralStatus(measurement) {
    if (!measurement) return { code: "no-data", label: "Geen gegevens" };
    const statuses = SCORE_METRICS.map((metric) => getStatus(measurement[metric]));
    if (statuses.some((status) => status.code === "action")) return { code: "action", label: "Actie aanbevolen" };
    if (statuses.some((status) => status.code === "attention" || status.code === "no-data")) return { code: "attention", label: "Aandacht" };
    return { code: "good", label: "Goed" };
  }

  function getGeneralExplanation(code) {
    if (code === "good") return "Alle beschikbare scores liggen op of boven de streefwaarde van 90.";
    if (code === "action") return "Een of meer onderdelen scoren lager dan 75. Gerichte verbeteringen zijn nodig.";
    if (code === "attention") return "Meerdere scores blijven onder de streefwaarde van 90. Gerichte verbeteringen worden aanbevolen.";
    return "Er zijn onvoldoende gegevens om de algemene status te bepalen.";
  }

  function parsePeriod(period) {
    const [year, month] = period.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, 1));
  }

  function formatPeriod(period) {
    return new Intl.DateTimeFormat("nl-NL", { month: "long", year: "numeric", timeZone: "UTC" }).format(parsePeriod(period));
  }

  function shortPeriod(period) {
    return new Intl.DateTimeFormat("nl-NL", { month: "short", timeZone: "UTC" }).format(parsePeriod(period)).replace(".", "");
  }

  function previousPeriod(period, monthsBack = 1) {
    const date = parsePeriod(period);
    date.setUTCMonth(date.getUTCMonth() - monthsBack);
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  }

  function findMeasurement(period) {
    return rapportageData.measurements.find((measurement) => measurement.period === period) || null;
  }

  function validateData(rawData) {
    if (!rawData || !Array.isArray(rawData.measurements) || rawData.measurements.length === 0) {
      throw new Error("Het rapportagebestand bevat geen metingen.");
    }

    const periods = new Set();
    rawData.measurements.forEach((measurement) => {
      if (!/^\d{4}-\d{2}$/.test(measurement.period) || periods.has(measurement.period)) {
        throw new Error(`Ongeldige of dubbele periode: ${measurement.period}`);
      }
      periods.add(measurement.period);
      SCORE_METRICS.forEach((metric) => {
        const value = measurement[metric];
        if (value !== null && value !== undefined && !isValidScore(value)) {
          throw new Error(`Ongeldige score voor ${metric} in ${measurement.period}`);
        }
      });
      if (typeof measurement.visitors !== "number" || measurement.visitors < 0) {
        throw new Error(`Ongeldig bezoekersaantal in ${measurement.period}`);
      }
    });

    rawData.measurements.sort((a, b) => a.period.localeCompare(b.period));
    return rawData;
  }

  function getSelectedMeasurements() {
    const select = getElement("rapportage-periode");
    const count = Number.parseInt(select?.value || "12", 10);
    return rapportageData.measurements.slice(-count);
  }

  function latest(measurements) {
    return measurements[measurements.length - 1] || null;
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("nl-NL").format(value);
  }

  function formatSignedPercent(value) {
    const sign = value > 0 ? "+" : "";
    return `${sign}${value.toLocaleString("nl-NL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
  }

  function renderMeta(latestMeasurement, measurements) {
    const target = getElement("rapportage-laatste-meting");
    if (!target || !latestMeasurement) return;
    const first = measurements[0];
    const updated = new Intl.DateTimeFormat("nl-NL", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Amsterdam" }).format(new Date(rapportageData.updatedAt));
    target.textContent = `Periode: ${formatPeriod(first.period)} – ${formatPeriod(latestMeasurement.period)}. Laatst bijgewerkt: ${updated}.`;
  }

  function buildAttentionPoints(measurements, latestMeasurement) {
    const points = [];
    SCORE_METRICS.forEach((metric) => {
      const score = latestMeasurement?.[metric];
      if (isValidScore(score) && score < SCORE_TARGET) {
        points.push({
          metric,
          title: `${labels[metric]}: score ${score}. Dit blijft onder de streefwaarde van 90.`,
          action: actions[metric],
        });
      }
    });

    const missing = measurements.find((measurement) =>
      SCORE_METRICS.some((metric) => measurement[metric] === null || measurement[metric] === undefined)
    );
    if (missing) {
      const missingLabels = SCORE_METRICS
        .filter((metric) => missing[metric] === null || missing[metric] === undefined)
        .map((metric) => labels[metric]);
      points.push({
        metric: "missing",
        title: `${missingLabels.join(" en ")}: in ${formatPeriod(missing.period)} ontbreekt een meting.`,
        action: "Controleer of de meting correct is uitgevoerd of opnieuw moet worden gestart.",
      });
    }
    return points;
  }

  function renderStatus(measurements, latestMeasurement) {
    const panel = getElement("rapportage-algemene-status");
    const title = getElement("rapportage-status-title");
    const explanation = getElement("rapportage-status-uitleg");
    const list = getElement("rapportage-aandachtspunten-lijst");
    const status = getGeneralStatus(latestMeasurement);
    panel.dataset.status = status.code;
    title.textContent = status.label;
    explanation.textContent = getGeneralExplanation(status.code);

    const points = buildAttentionPoints(measurements, latestMeasurement);
    list.innerHTML = points.length
      ? points.map((point) => `<li data-attention-metric="${point.metric}"><strong>${point.title}</strong><span>${point.action}</span></li>`).join("")
      : "<li><strong>Geen aandachtspunten.</strong><span>Alle beschikbare scores liggen op of boven de streefwaarde.</span></li>";
  }

  function comparisonText(metric, current, previous, previousYear) {
    const parts = [];
    if (isValidScore(current) && isValidScore(previous)) {
      const difference = current - previous;
      parts.push(difference === 0 ? "Gelijk aan de vorige maand" : `${Math.abs(difference)} ${Math.abs(difference) === 1 ? "punt" : "punten"} ${difference > 0 ? "hoger" : "lager"} dan de vorige maand`);
    }
    if (isValidScore(current) && isValidScore(previousYear)) {
      const difference = current - previousYear;
      parts.push(difference === 0 ? "Gelijk aan dezelfde maand vorig jaar" : `${Math.abs(difference)} ${Math.abs(difference) === 1 ? "punt" : "punten"} ${difference > 0 ? "hoger" : "lager"} dan dezelfde maand vorig jaar`);
    }
    return parts.length ? `${parts.join(". ")}.` : "Geen volledige vergelijking beschikbaar.";
  }

  function renderScoreCards(latestMeasurement) {
    const previous = findMeasurement(previousPeriod(latestMeasurement.period));
    const previousYear = findMeasurement(previousPeriod(latestMeasurement.period, 12));
    document.querySelectorAll(".rapportage-scorekaart[data-metric]").forEach((card) => {
      const metric = card.dataset.metric;
      const score = latestMeasurement[metric];
      const status = getStatus(score);
      card.dataset.status = status.code;
      card.querySelector("[data-score]").textContent = isValidScore(score) ? String(score) : "–";
      card.querySelector("[data-status]").textContent = status.label;
      card.querySelector("[data-comparison]").textContent = comparisonText(metric, score, previous?.[metric], previousYear?.[metric]);
    });
  }

  function renderVisitorsKpi(measurements, latestMeasurement) {
    const total = measurements.reduce((sum, measurement) => sum + measurement.visitors, 0);
    getElement("rapportage-bezoekers-kpi").textContent = formatNumber(total);
    const previous = findMeasurement(previousPeriod(latestMeasurement.period));
    const comparison = getElement("rapportage-bezoekers-kpi-vergelijking");
    if (!previous) {
      comparison.textContent = "Geen vergelijking met de vorige maand beschikbaar.";
      return;
    }
    const difference = latestMeasurement.visitors - previous.visitors;
    const percent = previous.visitors === 0 ? 0 : (difference / previous.visitors) * 100;
    comparison.textContent = difference === 0
      ? "Gelijk aan de vorige maand."
      : `${formatNumber(Math.abs(difference))} ${difference > 0 ? "meer" : "minder"} dan de vorige maand (${formatSignedPercent(percent)}).`;
    comparison.dataset.direction = difference > 0 ? "up" : difference < 0 ? "down" : "equal";
  }

  function renderVisitorsChart(measurements, latestMeasurement) {
    const container = getElement("rapportage-bezoekers-grafiek");
    const conclusion = getElement("rapportage-bezoekers-vergelijking");
    const width = 560;
    const height = 300;
    const padding = { left: 48, right: 16, top: 30, bottom: 52 };
    const graphWidth = width - padding.left - padding.right;
    const graphHeight = height - padding.top - padding.bottom;
    const maxValue = Math.max(...measurements.map((m) => m.visitors), 1);
    const step = graphWidth / measurements.length;
    const barWidth = Math.min(34, step * 0.68);

    const gridValues = [0, Math.round(maxValue / 2), maxValue];
    const grid = gridValues.map((value) => {
      const y = padding.top + graphHeight - (value / maxValue) * graphHeight;
      return `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" class="rapportage-grafiek-grid"/><text x="${padding.left - 8}" y="${y + 4}" text-anchor="end" class="rapportage-grafiek-aslabel">${formatNumber(value)}</text>`;
    }).join("");

    const bars = measurements.map((measurement, index) => {
      const x = padding.left + index * step + (step - barWidth) / 2;
      const barHeight = (measurement.visitors / maxValue) * graphHeight;
      const y = padding.top + graphHeight - barHeight;
      return `<g data-period="${measurement.period}"><text x="${x + barWidth / 2}" y="${Math.max(14, y - 7)}" text-anchor="middle" class="rapportage-grafiek-datalabel">${formatNumber(measurement.visitors)}</text><rect class="rapportage-bezoekers-balk" x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="4"><title>${formatPeriod(measurement.period)}: ${formatNumber(measurement.visitors)} bezoeken</title></rect><text x="${x + barWidth / 2}" y="${height - 20}" text-anchor="middle" class="rapportage-grafiek-aslabel">${shortPeriod(measurement.period)}</text></g>`;
    }).join("");

    container.setAttribute("aria-label", `Staafgrafiek met bezoekersaantallen over ${measurements.length} perioden`);
    container.innerHTML = `<svg viewBox="0 0 ${width} ${height}" aria-hidden="true" focusable="false">${grid}${bars}</svg>`;

    const previous = findMeasurement(previousPeriod(latestMeasurement.period));
    if (!previous) {
      conclusion.textContent = "Geen vergelijking met de vorige maand beschikbaar.";
    } else {
      const difference = latestMeasurement.visitors - previous.visitors;
      conclusion.textContent = difference === 0 ? "Het aantal bezoeken is gelijk aan de vorige maand." : `Het aantal bezoeken is ${difference > 0 ? "gestegen" : "gedaald"} met ${formatNumber(Math.abs(difference))} ten opzichte van de vorige maand.`;
    }
  }

  function metricColor(metric) {
    return { performance: "#f06400", accessibility: "#248b38", bestPractices: "#1769c2", seo: "#6d28d9" }[metric];
  }

  function renderTrendSummary(measurements) {
    const list = getElement("rapportage-trend-samenvatting-lijst");
    const points = SCORE_METRICS.map((metric) => {
      const valid = measurements.filter((m) => isValidScore(m[metric]));
      if (!valid.length) return `${labels[metric]}: er zijn geen metingen beschikbaar.`;
      const lowest = valid.reduce((current, measurement) => measurement[metric] < current[metric] ? measurement : current);
      const current = valid[valid.length - 1];
      if (metric === "performance" && lowest[metric] < 75) return `${labels[metric]} had een duidelijke dip in ${formatPeriod(lowest.period)} (${lowest[metric]}).`;
      return current[metric] >= SCORE_TARGET
        ? `${labels[metric]} blijft op een goed niveau (${current[metric]}).`
        : `${labels[metric]} blijft onder de streefwaarde van 90 (${current[metric]}).`;
    });
    const missing = measurements.find((measurement) => SCORE_METRICS.some((metric) => measurement[metric] === null || measurement[metric] === undefined));
    if (missing) points.push(`In ${formatPeriod(missing.period)} ontbreekt een of meer metingen.`);
    list.innerHTML = points.map((point) => `<li>${point}</li>`).join("");
  }

  function renderTrend(measurements) {
    const container = getElement("rapportage-trendgrafiek");
    const width = 900;
    const height = 330;
    const padding = { left: 48, right: 22, top: 54, bottom: 55 };
    const graphWidth = width - padding.left - padding.right;
    const graphHeight = height - padding.top - padding.bottom;
    const xStep = measurements.length > 1 ? graphWidth / (measurements.length - 1) : 0;
    const scoreToY = (score) => padding.top + graphHeight - (score / 100) * graphHeight;

    const grid = [0, 20, 40, 60, 80, 100].map((score) => {
      const y = scoreToY(score);
      return `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" class="rapportage-grafiek-grid"/><text x="${padding.left - 8}" y="${y + 4}" text-anchor="end" class="rapportage-grafiek-aslabel">${score}</text>`;
    }).join("");

    const monthLabels = measurements.map((measurement, index) => {
      const x = padding.left + index * xStep;
      const [month, year] = formatPeriod(measurement.period).split(" ");
      return `<text x="${x}" y="${height - 25}" text-anchor="middle" class="rapportage-grafiek-aslabel"><tspan x="${x}" dy="0">${month.slice(0, 3)}</tspan><tspan x="${x}" dy="14">${year}</tspan></text>`;
    }).join("");

    const series = SCORE_METRICS.map((metric) => {
      const color = metricColor(metric);
      const segments = [];
      let currentSegment = [];
      measurements.forEach((measurement, index) => {
        if (!isValidScore(measurement[metric])) {
          if (currentSegment.length) segments.push(currentSegment);
          currentSegment = [];
          return;
        }
        currentSegment.push({ x: padding.left + index * xStep, y: scoreToY(measurement[metric]), score: measurement[metric], period: measurement.period });
      });
      if (currentSegment.length) segments.push(currentSegment);
      const paths = segments.map((segment) => `<path d="${segment.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ")}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`).join("");
      const points = segments.flat().map((point) => `<circle cx="${point.x}" cy="${point.y}" r="4" fill="${color}"><title>${labels[metric]}, ${formatPeriod(point.period)}: ${point.score}</title></circle><text x="${point.x}" y="${point.y - 8}" text-anchor="middle" fill="${color}" class="rapportage-grafiek-datalabel">${point.score}</text>`).join("");
      return `<g data-series="${metric}">${paths}${points}</g>`;
    }).join("");

    const legend = SCORE_METRICS.map((metric, index) => {
      const x = 120 + index * 180;
      const color = metricColor(metric);
      return `<g data-legend="${metric}" transform="translate(${x}, 23)"><line x1="0" y1="0" x2="22" y2="0" stroke="${color}" stroke-width="3"/><circle cx="11" cy="0" r="4" fill="${color}"/><text x="30" y="4" class="rapportage-grafiek-legenda">${labels[metric]}</text></g>`;
    }).join("");

    container.setAttribute("aria-label", `Lijngrafiek met vier kwaliteitsscores over ${measurements.length} perioden`);
    container.innerHTML = `<svg viewBox="0 0 ${width} ${height}" aria-hidden="true" focusable="false">${legend}${grid}${monthLabels}${series}</svg>`;
    renderTrendSummary(measurements);
  }

  function renderHistory(measurements) {
    const tbody = getElement("rapportage-historie-body");
    tbody.innerHTML = [...measurements].reverse().map((measurement) => {
      const status = getGeneralStatus(measurement);
      const value = (score) => isValidScore(score) ? score : "–";
      return `<tr data-period="${measurement.period}"><th scope="row">${formatPeriod(measurement.period)}</th><td>${formatNumber(measurement.visitors)}</td><td>${value(measurement.performance)}</td><td>${value(measurement.accessibility)}</td><td>${value(measurement.bestPractices)}</td><td>${value(measurement.seo)}</td><td><span class="rapportage-historiestatus" data-status="${status.code}">${status.label}</span></td></tr>`;
    }).join("");
  }

  function renderReport() {
    hideError();
    const measurements = getSelectedMeasurements();
    const latestMeasurement = latest(measurements);
    renderMeta(latestMeasurement, measurements);
    renderStatus(measurements, latestMeasurement);
    renderVisitorsKpi(measurements, latestMeasurement);
    renderScoreCards(latestMeasurement);
    renderVisitorsChart(measurements, latestMeasurement);
    renderTrend(measurements);
    renderHistory(measurements);
  }

  function hideError() {
    const section = getElement("rapportage-foutmelding");
    if (section) section.hidden = true;
  }

  function showError(message) {
    const section = getElement("rapportage-foutmelding");
    const text = getElement("rapportage-foutmelding-tekst");
    if (text) text.textContent = message || "De rapportage kon niet worden geladen.";
    if (section) section.hidden = false;
  }

  async function loadReportData() {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`Het rapportagebestand kon niet worden geladen (${response.status}).`);
    return validateData(await response.json());
  }

  function bindFilters() {
    const select = getElement("rapportage-periode");
    if (!select) throw new Error("Het periodefilter ontbreekt.");
    select.addEventListener("change", renderReport);
  }

  async function init() {
    try {
      rapportageData = await loadReportData();
      bindFilters();
      renderReport();
    } catch (error) {
      console.error("Rapportage laden mislukt:", error);
      showError("De websiteprestaties konden niet worden geladen. Probeer het later opnieuw of neem contact op met de technisch beheerder.");
    }
  }

  window.rapportage = { init, getStatus, validateData };
})();
