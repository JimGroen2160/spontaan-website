(function () {
  let leden = [];
  let huidigePagina = 1;
  let currentProfile = null;

  const ledenFilters = {
    zoekterm: "",
    status: "all",
    role: "all",
    sortering: "full_name",
    pageSize: 10,
  };

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
    const toast = getElement("ledenbeheer-toast");

    if (toast) {
      toast.textContent = message;
      toast.className = `ledenbeheer-toast ${type}`;
      toast.style.display = "block";
    }
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function isValidDutchPostalCode(postalCode) {
    return /^[1-9][0-9]{3}\s?[A-Za-z]{2}$/.test(postalCode);
  }

  function isValidHouseNumber(houseNumber) {
    return /^[1-9][0-9]*\s?[-A-Za-z0-9/]*$/.test(houseNumber);
  }

  function isValidPhoneNumber(phone) {
    return /^\+?[0-9\s\-()/]{7,20}$/.test(phone);
  }

  function isMeaningfulText(value) {
    return /[A-Za-zÀ-ÿ]/.test(value);
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
      if (value.length < 2 || !isMeaningfulText(value)) {
        return "Volledige naam moet een geldige naam bevatten.";
      }
      return "";
    }

    if (fieldId === "street") {
      if (!value) {
        return "Straat is verplicht.";
      }
      if (value.length < 2 || !isMeaningfulText(value)) {
        return "Straat moet een geldige straatnaam bevatten.";
      }
      return "";
    }

    if (fieldId === "house_number") {
      if (!value) {
        return "Huisnummer is verplicht.";
      }
      if (!isValidHouseNumber(value)) {
        return "Huisnummer moet met een cijfer beginnen en mag eventueel een toevoeging bevatten, zoals 12A of 12-1.";
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
      if (value.length < 2 || !isMeaningfulText(value)) {
        return "Plaats moet een geldige plaatsnaam bevatten.";
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
      if (value && !isValidPhoneNumber(value)) {
        return "Telefoonnummer mag alleen cijfers, spaties, streepjes, haakjes, schuine streep en eventueel + aan het begin bevatten.";
      }
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
      "phone",
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

  function getGefilterdeLeden() {
    const zoekterm = ledenFilters.zoekterm.toLowerCase();
    const status = ledenFilters.status;
    const role = ledenFilters.role;
    const sortering = ledenFilters.sortering;

    return leden
      .filter((lid) => {
        const naam = String(lid.full_name || "").toLowerCase();
        const email = String(lid.email || "").toLowerCase();
        const lidStatus = String(lid.status || "");
        const lidRole = String(lid.role || "");

        const zoektermPast = !zoekterm || naam.includes(zoekterm) || email.includes(zoekterm);
        const statusPast = status === "all" || lidStatus === status;
        const rolePast = role === "all" || lidRole === role;

        return zoektermPast && statusPast && rolePast;
      })
      .sort((a, b) => {
        const valueA = String(a[sortering] || "").toLowerCase();
        const valueB = String(b[sortering] || "").toLowerCase();

        return valueA.localeCompare(valueB, "nl", { sensitivity: "base" });
      });
  }

  function getPaginering(gefilterdeLeden) {
    const pageSize = ledenFilters.pageSize;
    const totaalPaginas = Math.max(1, Math.ceil(gefilterdeLeden.length / pageSize));

    if (huidigePagina > totaalPaginas) {
      huidigePagina = totaalPaginas;
    }

    if (huidigePagina < 1) {
      huidigePagina = 1;
    }

    const startIndex = (huidigePagina - 1) * pageSize;
    const eindIndex = startIndex + pageSize;

    return {
      totaalPaginas,
      pageSize,
      startIndex,
      eindIndex,
      ledenVoorPagina: gefilterdeLeden.slice(startIndex, eindIndex),
    };
  }

  function renderResultCount(totaalGefilterd) {
    const resultCount = getElement("ledenbeheer-result-count");
    if (!resultCount) return;

    const totaal = leden.length;

    if (totaal === 0) {
      resultCount.textContent = "Geen leden beschikbaar.";
      return;
    }

    if (totaalGefilterd === totaal) {
      resultCount.textContent = `${totaal} leden gevonden.`;
      return;
    }

    resultCount.textContent = `${totaalGefilterd} van ${totaal} leden gevonden.`;
  }

  function renderPaginering(totaalPaginas) {
    const prevButton = getElement("ledenbeheer-prev-page");
    const nextButton = getElement("ledenbeheer-next-page");
    const pageStatus = getElement("ledenbeheer-page-status");

    if (pageStatus) {
      pageStatus.textContent = `Pagina ${huidigePagina} van ${totaalPaginas}`;
    }

    if (prevButton) {
      prevButton.disabled = huidigePagina <= 1;
    }

    if (nextButton) {
      nextButton.disabled = huidigePagina >= totaalPaginas;
    }
  }

  function closeActionMenus() {
    document.querySelectorAll(".ledenbeheer-action-menu.open").forEach((menu) => {
      menu.classList.remove("open");
      const trigger = menu.querySelector(".ledenbeheer-action-trigger");
      if (trigger) {
        trigger.setAttribute("aria-expanded", "false");
      }
    });
  }

  function renderLedenlijst() {
    const tbody = getElement("ledenbeheer-lijst-body");
    if (!tbody) return;

    const gefilterdeLeden = getGefilterdeLeden();
    const paginering = getPaginering(gefilterdeLeden);

    renderResultCount(gefilterdeLeden.length);
    renderPaginering(paginering.totaalPaginas);

    if (!paginering.ledenVoorPagina.length) {
      tbody.innerHTML = `
        <tr class="ledenbeheer-empty-row">
          <td colspan="5">Er zijn geen leden gevonden die aan de filters voldoen.</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = paginering.ledenVoorPagina
      .map((lid) => {
        const fullName = escapeHtml(lid.full_name || "-");
        const email = escapeHtml(lid.email || "-");
        const role = escapeHtml(lid.role || "-");
        const status = escapeHtml(lid.status || "-");
        const acties = renderLidActies(lid);

        return `
          <tr>
            <td>${fullName}</td>
            <td>${email}</td>
            <td><span class="role-badge">${role}</span></td>
            <td><span class="status-badge ${status}">${status}</span></td>
            <td>${acties}</td>
          </tr>
        `;
      })
      .join("");
  }

  function renderLidActies(lid) {
    const profileId = escapeHtml(lid.id || "");
    const status = String(lid.status || "");
    const role = String(lid.role || "");
    const isCurrentUser = currentProfile?.auth_user_id && lid.auth_user_id === currentProfile.auth_user_id;
    const menuId = `ledenbeheer-action-menu-${profileId}`;

    if (!profileId) {
      return "-";
    }

    if (isCurrentUser && role === "admin") {
      return "Eigen account";
    }

    let statusActie = "";

    if (status === "active") {
      statusActie = `
        <button type="button" class="ledenbeheer-menu-action deactivate" data-profile-id="${profileId}" data-new-status="inactive">
          Deactiveren
        </button>
      `;
    }

    if (status === "inactive") {
      statusActie = `
        <button type="button" class="ledenbeheer-menu-action activate" data-profile-id="${profileId}" data-new-status="active">
          Heractiveren
        </button>
      `;
    }

    return `
      <div class="ledenbeheer-action-menu">
        <button type="button" class="ledenbeheer-action-trigger" aria-haspopup="true" aria-expanded="false" aria-controls="${menuId}" data-action-menu-trigger>
          Acties ▾
        </button>
        <div id="${menuId}" class="ledenbeheer-action-dropdown" role="menu">
          <button type="button" class="ledenbeheer-menu-action edit" data-profile-id="${profileId}">
            Bewerken
          </button>
          ${statusActie}
        </div>
      </div>
    `;
  }

  function getLidByProfileId(profileId) {
    return leden.find((lid) => String(lid.id) === String(profileId));
  }

  function validateEditField(fieldId) {
    const value = normalize(getElement(fieldId)?.value);

    if (fieldId === "edit_full_name") {
      if (!value) {
        return "Volledige naam is verplicht.";
      }
      if (value.length < 2 || !isMeaningfulText(value)) {
        return "Volledige naam moet een geldige naam bevatten.";
      }
      return "";
    }

    if (fieldId === "edit_street") {
      if (!value) {
        return "Straat is verplicht.";
      }
      if (value.length < 2 || !isMeaningfulText(value)) {
        return "Straat moet een geldige straatnaam bevatten.";
      }
      return "";
    }

    if (fieldId === "edit_house_number") {
      if (!value) {
        return "Huisnummer is verplicht.";
      }
      if (!isValidHouseNumber(value)) {
        return "Huisnummer moet met een cijfer beginnen en mag eventueel een toevoeging bevatten, zoals 12A of 12-1.";
      }
      return "";
    }

    if (fieldId === "edit_postal_code") {
      if (!value) {
        return "Postcode is verplicht.";
      }
      if (!isValidDutchPostalCode(value.toUpperCase())) {
        return "Postcode is ongeldig. Gebruik bijvoorbeeld 1234AB of 1234 AB.";
      }
      return "";
    }

    if (fieldId === "edit_city") {
      if (!value) {
        return "Plaats is verplicht.";
      }
      if (value.length < 2 || !isMeaningfulText(value)) {
        return "Plaats moet een geldige plaatsnaam bevatten.";
      }
      return "";
    }

    if (fieldId === "edit_phone") {
      if (value && !isValidPhoneNumber(value)) {
        return "Telefoonnummer mag alleen cijfers, spaties, streepjes, haakjes, schuine streep en eventueel + aan het begin bevatten.";
      }
      return "";
    }

    return "";
  }

  function clearEditErrors() {
    [
      "edit_full_name",
      "edit_street",
      "edit_house_number",
      "edit_postal_code",
      "edit_city",
      "edit_phone",
    ].forEach(clearFieldError);
  }

  function bindEditFieldValidation(fieldId) {
    const input = getElement(fieldId);
    if (!input) return;

    input.addEventListener("blur", function () {
      const message = validateEditField(fieldId);

      if (message) {
        showFieldError(fieldId, message);
        setMelding(message, "error");
      } else {
        clearFieldError(fieldId);
      }
    });
  }

  function openEditModal(profileId) {
    const lid = getLidByProfileId(profileId);
    const modal = getElement("ledenbeheer-edit-modal");

    if (!lid || !modal) {
      setMelding("Lid kon niet worden geopend voor bewerken.", "error");
      return;
    }

    clearEditErrors();

    getElement("edit_profile_id").value = lid.id || "";
    getElement("edit_full_name").value = lid.full_name || "";
    getElement("edit_street").value = lid.street || "";
    getElement("edit_house_number").value = lid.house_number || "";
    getElement("edit_postal_code").value = lid.postal_code || "";
    getElement("edit_city").value = lid.city || "";
    getElement("edit_phone").value = lid.phone || "";
    getElement("edit_email").value = lid.email || "";
    getElement("edit_role").value = lid.role || "";
    getElement("edit_status").value = lid.status || "";

    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    getElement("edit_full_name")?.focus();
  }

  function closeEditModal() {
    const modal = getElement("ledenbeheer-edit-modal");
    const form = getElement("ledenbeheer-edit-form");

    if (modal) {
      modal.classList.remove("open");
      modal.setAttribute("aria-hidden", "true");
    }

    if (form) {
      form.reset();
    }

    clearEditErrors();
  }

  function validateEditForm() {
    const fields = [
      "edit_full_name",
      "edit_street",
      "edit_house_number",
      "edit_postal_code",
      "edit_city",
      "edit_phone",
    ];

    for (const fieldId of fields) {
      const message = validateEditField(fieldId);
      if (message) {
        showFieldError(fieldId, message);
        return { valid: false, message };
      }
      clearFieldError(fieldId);
    }

    return {
      valid: true,
      data: {
        id: normalize(getElement("edit_profile_id")?.value),
        full_name: normalize(getElement("edit_full_name")?.value),
        street: normalize(getElement("edit_street")?.value),
        house_number: normalize(getElement("edit_house_number")?.value),
        postal_code: normalize(getElement("edit_postal_code")?.value).toUpperCase(),
        city: normalize(getElement("edit_city")?.value),
        phone: normalize(getElement("edit_phone")?.value),
      },
    };
  }

  async function updateLidGegevens(data) {
    if (!data?.id) {
      setMelding("Lid kon niet worden opgeslagen.", "error");
      return;
    }

    const client = getSupabaseClient();

    const { error } = await client
      .from("profiles")
      .update({
        full_name: data.full_name,
        street: data.street,
        house_number: data.house_number,
        postal_code: data.postal_code,
        city: data.city,
        phone: data.phone,
      })
      .eq("id", data.id);

    if (error) {
      console.error("Lidgegevens wijzigen mislukt:", error);
      setMelding("Lidgegevens konden niet worden opgeslagen.", "error");
      return;
    }

    await laadLedenlijst();
    closeEditModal();
    setMelding("Lidgegevens zijn opgeslagen.", "success");
  }

  async function updateLidStatus(profileId, nieuweStatus) {
    if (!profileId || !["active", "inactive"].includes(nieuweStatus)) {
      setMelding("Ongeldige statuswijziging.", "error");
      return;
    }

    const client = getSupabaseClient();

    const { error } = await client
      .from("profiles")
      .update({ status: nieuweStatus })
      .eq("id", profileId);

    if (error) {
      console.error("Status wijzigen mislukt:", error);
      setMelding("Status van het lid kon niet worden gewijzigd.", "error");
      return;
    }

    await laadLedenlijst();

    const melding = nieuweStatus === "inactive"
      ? "Lid is gedeactiveerd."
      : "Lid is geheractiveerd.";

    setMelding(melding, "success");
  }

  async function laadLedenlijst() {
    const client = getSupabaseClient();

    const { data, error } = await client
      .from("profiles")
      .select("id, auth_user_id, full_name, street, house_number, postal_code, city, phone, email, role, status")
      .order("full_name", { ascending: true });

    if (error) {
      console.error("Ledenlijst laden mislukt:", error);
      setMelding("Ledenlijst kon niet worden geladen.", "error");
      leden = [];
      renderLedenlijst();
      return;
    }

    leden = Array.isArray(data) ? data : [];
    huidigePagina = 1;
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

  function bindLedenlijstActies() {
    const tbody = getElement("ledenbeheer-lijst-body");
    if (!tbody) return;

    tbody.addEventListener("click", async function (event) {
      const trigger = event.target.closest(".ledenbeheer-action-trigger");
      if (trigger) {
        const menu = trigger.closest(".ledenbeheer-action-menu");
        const isOpen = menu.classList.contains("open");

        closeActionMenus();

        if (!isOpen) {
          menu.classList.add("open");
          trigger.setAttribute("aria-expanded", "true");
        }

        return;
      }

      const button = event.target.closest(".ledenbeheer-menu-action");
      if (!button) return;

      const profileId = button.getAttribute("data-profile-id");

      closeActionMenus();

      if (button.classList.contains("edit")) {
        openEditModal(profileId);
        return;
      }

      const nieuweStatus = button.getAttribute("data-new-status");

      button.disabled = true;

      try {
        await updateLidStatus(profileId, nieuweStatus);
      } finally {
        button.disabled = false;
      }
    });

    document.addEventListener("click", function (event) {
      if (!event.target.closest(".ledenbeheer-action-menu")) {
        closeActionMenus();
      }
    });
  }

  function bindEditModal() {
    const form = getElement("ledenbeheer-edit-form");
    const cancelButton = getElement("ledenbeheer-edit-cancel");
    const modal = getElement("ledenbeheer-edit-modal");

    [
      "edit_full_name",
      "edit_street",
      "edit_house_number",
      "edit_postal_code",
      "edit_city",
      "edit_phone",
    ].forEach(bindEditFieldValidation);

    if (form) {
      form.addEventListener("submit", async function (event) {
        event.preventDefault();

        const validation = validateEditForm();

        if (!validation.valid) {
          setMelding(validation.message, "error");
          return;
        }

        await updateLidGegevens(validation.data);
      });
    }

    if (cancelButton) {
      cancelButton.addEventListener("click", closeEditModal);
    }

    if (modal) {
      modal.addEventListener("click", function (event) {
        if (event.target === modal) {
          closeEditModal();
        }
      });
    }
  }

  function bindLedenlijstControls() {
    const zoekInput = getElement("ledenbeheer-zoek");
    const statusFilter = getElement("ledenbeheer-status-filter");
    const roleFilter = getElement("ledenbeheer-role-filter");
    const sorteringSelect = getElement("ledenbeheer-sortering");
    const pageSizeSelect = getElement("ledenbeheer-page-size");
    const prevButton = getElement("ledenbeheer-prev-page");
    const nextButton = getElement("ledenbeheer-next-page");

    if (zoekInput) {
      zoekInput.addEventListener("input", function () {
        ledenFilters.zoekterm = normalize(zoekInput.value);
        huidigePagina = 1;
        renderLedenlijst();
      });
    }

    if (statusFilter) {
      statusFilter.addEventListener("change", function () {
        ledenFilters.status = statusFilter.value;
        huidigePagina = 1;
        renderLedenlijst();
      });
    }

    if (roleFilter) {
      roleFilter.addEventListener("change", function () {
        ledenFilters.role = roleFilter.value;
        huidigePagina = 1;
        renderLedenlijst();
      });
    }

    if (sorteringSelect) {
      sorteringSelect.addEventListener("change", function () {
        ledenFilters.sortering = sorteringSelect.value;
        huidigePagina = 1;
        renderLedenlijst();
      });
    }

    if (pageSizeSelect) {
      pageSizeSelect.addEventListener("change", function () {
        ledenFilters.pageSize = Number(pageSizeSelect.value) || 10;
        huidigePagina = 1;
        renderLedenlijst();
      });
    }

    if (prevButton) {
      prevButton.addEventListener("click", function () {
        huidigePagina -= 1;
        renderLedenlijst();
      });
    }

    if (nextButton) {
      nextButton.addEventListener("click", function () {
        huidigePagina += 1;
        renderLedenlijst();
      });
    }
  }

  async function initLedenbeheer() {
    const formulierBlok = getElement("ledenbeheer-formulier");
    const lijstBlok = getElement("ledenbeheer-lijst");

    if (!formulierBlok || !lijstBlok) {
      console.warn("Ledenbeheer placeholders niet gevonden.");
      return;
    }

    setMelding("Ledenbeheer wordt geladen.", "info");
    currentProfile = await window.authHelpers.getCurrentProfile();
    initNieuwLidFormulier();
    bindLedenlijstControls();
    bindLedenlijstActies();
    bindEditModal();

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