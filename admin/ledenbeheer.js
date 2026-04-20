(function () {
    let tijdelijkeLeden = [];
  
    function getElement(id) {
      return document.getElementById(id);
    }
  
    function normalize(value) {
      return typeof value === "string" ? value.trim() : "";
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
  
    function bestaatTijdelijkEmailAl(email) {
      const normalizedEmail = normalize(email).toLowerCase();
      return tijdelijkeLeden.some((lid) => lid.email === normalizedEmail);
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
  
      const data = {
        full_name: normalize(getElement("full_name")?.value),
        street: normalize(getElement("street")?.value),
        house_number: normalize(getElement("house_number")?.value),
        postal_code: normalize(getElement("postal_code")?.value).toUpperCase(),
        city: normalize(getElement("city")?.value),
        email: normalize(getElement("email")?.value).toLowerCase(),
        email_confirm: normalize(getElement("email_confirm")?.value).toLowerCase(),
        phone: normalize(getElement("phone")?.value),
      };
  
      if (bestaatTijdelijkEmailAl(data.email)) {
        showFieldError("email", "Dit e-mailadres bestaat al in de tijdelijke lijst.");
        showFieldError("email_confirm", "Dit e-mailadres bestaat al in de tijdelijke lijst.");
        return {
          valid: false,
          message: "Er bestaat al een lid met dit e-mailadres in de tijdelijke lijst.",
          fieldId: "email",
        };
      }
  
      clearFieldError("email");
      clearFieldError("email_confirm");
  
      return {
        valid: true,
        data,
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
  
    function renderLedenlijst() {
      const tbody = getElement("ledenbeheer-lijst-body");
      if (!tbody) return;
  
      if (!tijdelijkeLeden.length) {
        tbody.innerHTML = `
          <tr class="ledenbeheer-empty-row">
            <td colspan="4">Nog geen leden geladen. De datakoppeling volgt in een volgende stap.</td>
          </tr>
        `;
        return;
      }
  
      tbody.innerHTML = tijdelijkeLeden
        .map((lid) => {
          return `
            <tr>
              <td>${lid.full_name}</td>
              <td>${lid.email}</td>
              <td><span class="role-badge">${lid.role}</span></td>
              <td><span class="status-badge ${lid.status}">${lid.status}</span></td>
            </tr>
          `;
        })
        .join("");
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
  
    function voegTijdelijkLidToe(data) {
      tijdelijkeLeden.unshift({
        full_name: data.full_name,
        email: data.email,
        role: "member",
        status: "pending",
      });
  
      renderLedenlijst();
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
  
      form.addEventListener("submit", function (event) {
        event.preventDefault();
  
        const validation = validateNieuwLidForm();
  
        if (!validation.valid) {
          setMelding(validation.message, "error");
          console.warn("Validatiefout nieuw lid formulier:", validation.message);
          return;
        }
  
        voegTijdelijkLidToe(validation.data);
        resetNieuwLidForm();
  
        setMelding(
          "Frontend-validatie geslaagd. Het lid is tijdelijk aan de lijst toegevoegd. Opslaan naar backend volgt in een volgende stap.",
          "success"
        );
        console.log("Nieuw lid formulier validatie geslaagd.", validation.data);
      });
    }
  
    function initLedenbeheer() {
      const formulierBlok = getElement("ledenbeheer-formulier");
      const lijstBlok = getElement("ledenbeheer-lijst");
  
      if (!formulierBlok || !lijstBlok) {
        console.warn("Ledenbeheer placeholders niet gevonden.");
        return;
      }
  
      setMelding("Ledenbeheer is voorbereid voor de volgende stap.", "info");
      initNieuwLidFormulier();
      renderLedenlijst();
  
      console.log("Ledenbeheer initialisatie uitgevoerd.");
    }
  
    window.ledenbeheer = {
      init: initLedenbeheer,
      setMelding,
    };
  })();