(function () {
  let leden = [];

  function getElement(id) {
    return document.getElementById(id);
  }

  function normalize(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function setMelding(message, type = "info") {
    const melding = getElement("ledenbeheer-melding");
    if (!melding) return;

    melding.textContent = message;
    melding.style.display = "block";

    if (type === "error") {
      melding.style.background = "#fbeaea";
      melding.style.color = "#8a1f1f";
      melding.style.border = "1px solid #e2b4b4";
    } else if (type === "success") {
      melding.style.background = "#eaf7ea";
      melding.style.color = "#1f6b2d";
      melding.style.border = "1px solid #b7d8bd";
    } else {
      melding.style.background = "#f4f4f4";
      melding.style.color = "#333";
      melding.style.border = "1px solid #ddd";
    }
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function isValidDutchPostalCode(postalCode) {
    return /^[1-9][0-9]{3}\s?[A-Za-z]{2}$/.test(postalCode);
  }

  function showFieldError(fieldId, message) {
    const input = getElement(fieldId);
    const errorElement = getElement(fieldId + "_error");

    if (input) {
      input.classList.add("field-error");
    }

    if (errorElement) {
      errorElement.textContent = message;
      errorElement.style.display = "block";
    }
  }

  function clearFieldError(fieldId) {
    const input = getElement(fieldId);
    const errorElement = getElement(fieldId + "_error");

    if (input) {
      input.classList.remove("field-error");
    }

    if (errorElement) {
      errorElement.textContent = "";
      errorElement.style.display = "none";
    }
  }

  function validateSingleField(fieldId) {
    const value = normalize(getElement(fieldId)?.value);

    if (fieldId === "full_name") {
      if (!value) {
        return "Volledige naam is verplicht.";
      }
      return "";
    }

    if (fieldId === "street") {
      if (!value) {
        return "Straat is verplicht.";
      }
      return "";
    }

    if (fieldId === "house_number") {
      if (!value) {
        return "Huisnummer is verplicht.";
      }
      return "";
    }

    if (fieldId === "postal_code") {
      if (!value) {
        return "Postcode is verplicht.";
      }
      if (!isValidDutchPostalCode(value.toUpperCase())) {
        return "Postcode is ongeldig. Gebruik bijvoorbeeld 1234AB of 1234 AB.";
      }
      return "";
    }

    if (fieldId === "city") {
      if (!value) {
        return "Plaats is verplicht.";
      }
      return "";
    }

    if (fieldId === "email") {
      if (!value) {
        return "E-mailadres is verplicht.";
      }
      if (!isValidEmail(value.toLowerCase())) {
        return "E-mailadres is ongeldig.";
      }
      return "";
    }

    if (fieldId === "email_confirm") {
      const email = normalize(getElement("email")?.value).toLowerCase();
      const emailConfirm = value.toLowerCase();

      if (!emailConfirm) {
        return "Bevestiging van e-mailadres is verplicht.";
      }
      if (!isValidEmail(emailConfirm)) {
        return "Bevestiging van e-mailadres is ongeldig.";
      }
      if (email && email !== emailConfirm) {
        return "De ingevoerde e-mailadressen komen niet overeen.";
      }
      return "";
    }

    if (fieldId === "phone") {
      return "";
    }

    return "";
  }

  function validateNieuwLidForm() {
    const fields = [
      "full_name",
      "street",
      "house_number",
      "postal_code",
      "city",
      "email",
      "email_confirm",
    ];

    for (const fieldId of fields) {
      const message = validateSingleField(fieldId);
      if (message) {
        showFieldError(fieldId, message);
        return { valid: false, message, fieldId };
      }
      clearFieldError(fieldId);
    }

    return {
      valid: true,
      data: {
        full_name: normalize(getElement("full_name")?.value),
        street: normalize(getElement("street")?.value),
        house_number: normalize(getElement("house_number")?.value),
        postal_code: normalize(getElement("postal_code")?.value).toUpperCase(),
        city: normalize(getElement("city")?.value),
        email: normalize(getElement("email")?.value).toLowerCase(),
        email_confirm: normalize(getElement("email_confirm")?.value).toLowerCase(),
        phone: normalize(getElement("phone")?.value),
      },
    };
  }

  function bindFieldValidation(fieldId) {
    const input = getElement(fieldId);
    if (!input) return;

    input.addEventListener("blur", function () {
      const message = validateSingleField(fieldId);

      if (message) {
        showFieldError(fieldId, message);
        setMelding(message, "error");
      } else {
        clearFieldError(fieldId);
      }
    });
  }

  function getSupabaseClient() {
    if (!window.authHelpers || typeof window.authHelpers.ensureSupabaseClient !== "function") {
      throw new Error("Auth helpers zijn niet beschikbaar.");
    }

    return window.authHelpers.ensureSupabaseClient();
  }

  function renderLedenlijst(teTonenLeden = leden) {
    const tbody = getElement("ledenbeheer-lijst-body");
    if (!tbody) return;

    if (!teTonenLeden.length) {
      tbody.innerHTML = `
        <tr class="ledenbeheer-empty-row">
          <td colspan="4">Er zijn nog geen leden gevonden.</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = teTonenLeden
      .map((lid) => {
        const fullName = escapeHtml(lid.full_name || "-");
        const email = escapeHtml(lid.email || "-");
        const role = escapeHtml(lid.role || "-");
        const status = escapeHtml(lid.status || "-");

        return `
          <tr>
            <td>${fullName}</td>
            <td>${email}</td>
            <td><span class="role-badge">${role}</span></td>
            <td><span class="status-badge ${status}">${status}</span></td>
          </tr>
        `;
      })
      .join("");
  }

  async function laadLedenlijst() {
    const client = getSupabaseClient();

    const { data, error } = await client
      .from("profiles")
      .select("full_name, email, role, status")
      .order("full_name", { ascending: true });

    if (error) {
      console.error("Ledenlijst laden mislukt:", error);
      setMelding("Ledenlijst kon niet worden geladen.", "error");
      leden = [];
      renderLedenlijst();
      return;
    }

    leden = Array.isArray(data) ? data : [];
    renderLedenlijst();
  }

  function resetNieuwLidForm() {
    const form = getElement("nieuw-lid-form");
    if (!form) return;

    form.reset();

    [
      "full_name",
      "street",
      "house_number",
      "postal_code",
      "city",
      "email",
      "email_confirm",
      "phone",
    ].forEach(clearFieldError);
  }

  async function createMemberViaFunction(data) {
    if (!window.authHelpers || typeof window.authHelpers.getCurrentSession !== "function") {
      throw new Error("Auth helpers zijn niet beschikbaar.");
    }

    const session = await window.authHelpers.getCurrentSession();
    const accessToken = session?.access_token;

    if (!accessToken) {
      throw new Error("Geen geldige sessie beschikbaar.");
    }

    if (!window.authHelpers.supabaseUrl) {
      throw new Error("Supabase URL is niet beschikbaar.");
    }

    if (!window.authHelpers.supabaseKey) {
      throw new Error("Supabase publishable key is niet beschikbaar.");
    }

    const response = await fetch(
      `${window.authHelpers.supabaseUrl}/functions/v1/create-member`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          apikey: window.authHelpers.supabaseKey,
        },
        body: JSON.stringify(data),
      }
    );

    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error("Ongeldige response ontvangen van de create-member functie.");
    }

    if (!response.ok || !result?.success) {
      throw new Error(result?.message || "Ledenaanmaak is mislukt.");
    }

    return result;
  }

  function initNieuwLidFormulier() {
    const form = getElement("nieuw-lid-form");
    if (!form) {
      console.warn("Formulier nieuw lid niet gevonden.");
      return;
    }

    [
      "full_name",
      "street",
      "house_number",
      "postal_code",
      "city",
      "email",
      "email_confirm",
      "phone",
    ].forEach(bindFieldValidation);

    form.addEventListener("submit", async function (event) {
      event.preventDefault();

      const validation = validateNieuwLidForm();

      if (!validation.valid) {
        setMelding(validation.message, "error");
        console.warn("Validatiefout nieuw lid formulier:", validation.message);
        return;
      }

      try {
        const result = await createMemberViaFunction(validation.data);

        resetNieuwLidForm();
        await laadLedenlijst();

        setMelding(
          result.message || "Lid succesvol uitgenodigd en profiel aangemaakt.",
          "success"
        );
        console.log("Create-member functie succesvol uitgevoerd.", result);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Er is een onbekende fout opgetreden bij ledenaanmaak.";

        setMelding(message, "error");
        console.error("Fout bij create-member functie:", error);
      }
    });
  }

  async function initLedenbeheer() {
    const formulierBlok = getElement("ledenbeheer-formulier");
    const lijstBlok = getElement("ledenbeheer-lijst");

    if (!formulierBlok || !lijstBlok) {
      console.warn("Ledenbeheer placeholders niet gevonden.");
      return;
    }

    setMelding("Ledenbeheer wordt geladen.", "info");
    initNieuwLidFormulier();

    try {
      await laadLedenlijst();
      setMelding("Ledenbeheer is geladen.", "success");
    } catch (error) {
      console.error("Fout bij initialiseren ledenbeheer:", error);
      setMelding("Ledenbeheer kon niet volledig worden geladen.", "error");
    }

    console.log("Ledenbeheer initialisatie uitgevoerd.");
  }

  window.ledenbeheer = {
    init: initLedenbeheer,
    setMelding,
    laadLedenlijst,
  };
})();