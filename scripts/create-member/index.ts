import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

type CreateMemberPayload = {
  full_name: string;
  street: string;
  house_number: string;
  postal_code: string;
  city: string;
  email: string;
  email_confirm: string;
  phone?: string | null;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value: unknown): string {
  return normalizeString(value).toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidDutchPostalCode(postalCode: string): boolean {
  return /^[1-9][0-9]{3}\s?[A-Za-z]{2}$/.test(postalCode);
}

function validatePayload(payload: Partial<CreateMemberPayload>): string | null {
  const fullName = normalizeString(payload.full_name);
  const street = normalizeString(payload.street);
  const houseNumber = normalizeString(payload.house_number);
  const postalCode = normalizeString(payload.postal_code);
  const city = normalizeString(payload.city);
  const email = normalizeEmail(payload.email);
  const emailConfirm = normalizeEmail(payload.email_confirm);

  if (!fullName) return "Volledige naam is verplicht.";
  if (!street) return "Straat is verplicht.";
  if (!houseNumber) return "Huisnummer is verplicht.";
  if (!postalCode) return "Postcode is verplicht.";
  if (!city) return "Plaats is verplicht.";
  if (!email) return "E-mailadres is verplicht.";
  if (!emailConfirm) return "Bevestiging van e-mailadres is verplicht.";

  if (!isValidEmail(email)) return "E-mailadres is ongeldig.";
  if (!isValidEmail(emailConfirm)) return "Bevestiging van e-mailadres is ongeldig.";
  if (email !== emailConfirm) return "De ingevoerde e-mailadressen komen niet overeen.";
  if (!isValidDutchPostalCode(postalCode)) {
    return "Postcode is ongeldig. Gebruik bijvoorbeeld 1234AB of 1234 AB.";
  }

  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      { success: false, code: "METHOD_NOT_ALLOWED", message: "Alleen POST is toegestaan." },
      405,
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      return jsonResponse(
        { success: false, code: "SERVER_CONFIG_ERROR", message: "Serverconfiguratie is niet volledig." },
        500,
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse(
        { success: false, code: "UNAUTHORIZED", message: "Geen autorisatieheader ontvangen." },
        401,
      );
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    const {
      data: { user },
      error: getUserError,
    } = await userClient.auth.getUser();

    if (getUserError || !user) {
      return jsonResponse(
        { success: false, code: "UNAUTHORIZED", message: "Gebruiker is niet ingelogd of niet geldig." },
        401,
      );
    }

    const { data: adminProfile, error: adminProfileError } = await adminClient
      .from("profiles")
      .select("auth_user_id, role, status")
      .eq("auth_user_id", user.id)
      .single();

    if (adminProfileError || !adminProfile) {
      return jsonResponse(
        { success: false, code: "FORBIDDEN", message: "Profiel van admin is niet beschikbaar." },
        403,
      );
    }

    if (adminProfile.role !== "admin" || adminProfile.status !== "active") {
      return jsonResponse(
        { success: false, code: "FORBIDDEN", message: "Je hebt geen rechten om leden toe te voegen." },
        403,
      );
    }

    const rawPayload = (await req.json()) as Partial<CreateMemberPayload>;
    const validationError = validatePayload(rawPayload);

    if (validationError) {
      return jsonResponse(
        { success: false, code: "VALIDATION_ERROR", message: validationError },
        400,
      );
    }

    const payload: CreateMemberPayload = {
      full_name: normalizeString(rawPayload.full_name),
      street: normalizeString(rawPayload.street),
      house_number: normalizeString(rawPayload.house_number),
      postal_code: normalizeString(rawPayload.postal_code).toUpperCase(),
      city: normalizeString(rawPayload.city),
      email: normalizeEmail(rawPayload.email),
      email_confirm: normalizeEmail(rawPayload.email_confirm),
      phone: normalizeString(rawPayload.phone) || null,
    };

    const { data: existingProfile, error: existingProfileError } = await adminClient
      .from("profiles")
      .select("id, email")
      .eq("email", payload.email)
      .maybeSingle();

    if (existingProfileError) {
      return jsonResponse(
        { success: false, code: "PROFILE_LOOKUP_FAILED", message: "Bestaande leden konden niet worden gecontroleerd." },
        500,
      );
    }

    if (existingProfile) {
      return jsonResponse(
        { success: false, code: "EMAIL_EXISTS", message: "Er bestaat al een lid met dit e-mailadres." },
        409,
      );
    }

    const { data: listUsersData, error: listUsersError } = await adminClient.auth.admin.listUsers();

    if (listUsersError) {
      return jsonResponse(
        { success: false, code: "AUTH_LOOKUP_FAILED", message: "Bestaande accounts konden niet worden gecontroleerd." },
        500,
      );
    }

    const existingAuthUser = listUsersData.users.find(
      (candidate) => candidate.email?.toLowerCase() === payload.email,
    );

    if (existingAuthUser) {
      return jsonResponse(
        { success: false, code: "EMAIL_EXISTS", message: "Er bestaat al een account met dit e-mailadres." },
        409,
      );
    }

    const { data: invitedUserData, error: inviteError } =
      await adminClient.auth.admin.inviteUserByEmail(payload.email, {
        data: {
          full_name: payload.full_name,
        },
      });

    if (inviteError || !invitedUserData.user) {
      return jsonResponse(
        { success: false, code: "INVITE_FAILED", message: "Uitnodiging verzenden is mislukt." },
        500,
      );
    }

    const invitedUserId = invitedUserData.user.id;

    const { error: insertProfileError } = await adminClient
      .from("profiles")
      .insert({
        auth_user_id: invitedUserId,
        full_name: payload.full_name,
        street: payload.street,
        house_number: payload.house_number,
        postal_code: payload.postal_code,
        city: payload.city,
        phone: payload.phone,
        email: payload.email,
        role: "member",
        status: "pending",
      });

    if (insertProfileError) {
      return jsonResponse(
        {
          success: false,
          code: "PROFILE_INSERT_FAILED",
          message: "Uitnodiging is verstuurd, maar profiel kon niet worden opgeslagen. Handmatige controle is nodig.",
        },
        500,
      );
    }

    return jsonResponse({
      success: true,
      message: "Lid succesvol uitgenodigd en profiel aangemaakt.",
      member: {
        full_name: payload.full_name,
        email: payload.email,
        role: "member",
        status: "pending",
      },
    });
  } catch (error) {
    console.error("Onverwachte fout in create-member:", error);

    return jsonResponse(
      { success: false, code: "UNEXPECTED_ERROR", message: "Er is een onverwachte fout opgetreden." },
      500,
    );
  }
});