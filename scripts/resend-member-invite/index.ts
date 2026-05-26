import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

type ResendMemberInvitePayload = {
  profile_id: string;
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

function decodeJwtPayload(accessToken: string): Record<string, unknown> | null {
  try {
    const parts = accessToken.split(".");
    if (parts.length !== 3) {
      return null;
    }

    const payload = parts[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    const paddedPayload = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    const decodedPayload = atob(paddedPayload);

    return JSON.parse(decodedPayload);
  } catch (error) {
    console.error("JWT payload kon niet worden gedecodeerd:", error);
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      {
        success: false,
        code: "METHOD_NOT_ALLOWED",
        message: "Alleen POST is toegestaan.",
      },
      405,
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return jsonResponse(
        {
          success: false,
          code: "SERVER_CONFIG_ERROR",
          message: "Serverconfiguratie is niet volledig.",
        },
        500,
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return jsonResponse(
        {
          success: false,
          code: "UNAUTHORIZED",
          message: "Geen geldige autorisatieheader ontvangen.",
        },
        401,
      );
    }

    const accessToken = authHeader.replace("Bearer ", "").trim();

    if (!accessToken) {
      return jsonResponse(
        {
          success: false,
          code: "UNAUTHORIZED",
          message: "Geen geldige access token ontvangen.",
        },
        401,
      );
    }

    const jwtPayload = decodeJwtPayload(accessToken);
    const userId = typeof jwtPayload?.sub === "string" ? jwtPayload.sub : null;

    if (!userId) {
      return jsonResponse(
        {
          success: false,
          code: "UNAUTHORIZED",
          message: "Gebruiker is niet ingelogd of niet geldig.",
        },
        401,
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: adminProfile, error: adminProfileError } = await adminClient
      .from("profiles")
      .select("auth_user_id, role, status")
      .eq("auth_user_id", userId)
      .single();

    if (adminProfileError || !adminProfile) {
      console.error("Adminprofiel fout:", adminProfileError);
      return jsonResponse(
        {
          success: false,
          code: "FORBIDDEN",
          message: "Profiel van admin is niet beschikbaar.",
        },
        403,
      );
    }

    if (adminProfile.role !== "admin" || adminProfile.status !== "active") {
      return jsonResponse(
        {
          success: false,
          code: "FORBIDDEN",
          message: "Je hebt geen rechten om leden opnieuw uit te nodigen.",
        },
        403,
      );
    }

    const rawPayload = (await req.json()) as Partial<ResendMemberInvitePayload>;
    const profileId = normalizeString(rawPayload.profile_id);

    if (!profileId) {
      return jsonResponse(
        {
          success: false,
          code: "VALIDATION_ERROR",
          message: "Profiel-id is verplicht.",
        },
        400,
      );
    }

    const { data: memberProfile, error: memberProfileError } = await adminClient
      .from("profiles")
      .select("id, auth_user_id, full_name, email, role, status")
      .eq("id", profileId)
      .single();

    if (memberProfileError || !memberProfile) {
      console.error("Lidprofiel fout:", memberProfileError);
      return jsonResponse(
        {
          success: false,
          code: "PROFILE_NOT_FOUND",
          message: "Lidprofiel is niet gevonden.",
        },
        404,
      );
    }

    if (memberProfile.role !== "member") {
      return jsonResponse(
        {
          success: false,
          code: "INVALID_ROLE",
          message: "Alleen leden met role member kunnen opnieuw worden uitgenodigd.",
        },
        400,
      );
    }

    if (memberProfile.status !== "pending") {
      return jsonResponse(
        {
          success: false,
          code: "INVALID_STATUS",
          message: "Alleen pending leden kunnen opnieuw worden uitgenodigd.",
        },
        400,
      );
    }

    if (!memberProfile.email) {
      return jsonResponse(
        {
          success: false,
          code: "EMAIL_MISSING",
          message: "Voor dit lid is geen e-mailadres beschikbaar.",
        },
        400,
      );
    }

    const { data: listUsersData, error: listUsersError } = await adminClient.auth.admin.listUsers();

    if (listUsersError) {
      console.error("Auth lookup fout:", listUsersError);
      return jsonResponse(
        {
          success: false,
          code: "AUTH_LOOKUP_FAILED",
          message: "Bestaande accounts konden niet worden gecontroleerd.",
        },
        500,
      );
    }

    const existingAuthUser = listUsersData.users.find(
      (candidate) => candidate.email?.toLowerCase() === memberProfile.email.toLowerCase(),
    );

    if (!existingAuthUser) {
      return jsonResponse(
        {
          success: false,
          code: "AUTH_USER_NOT_FOUND",
          message: "Bij dit pending lid is geen Supabase Auth-account gevonden.",
        },
        404,
      );
    }

    if (memberProfile.auth_user_id && existingAuthUser.id !== memberProfile.auth_user_id) {
      return jsonResponse(
        {
          success: false,
          code: "AUTH_PROFILE_MISMATCH",
          message: "Het Auth-account komt niet overeen met het profielrecord.",
        },
        409,
      );
    }

    const { error: resetError } = await adminClient.auth.resetPasswordForEmail(memberProfile.email);

    if (resetError) {
      console.error("Opnieuw uitnodigen mislukt:", resetError);
      return jsonResponse(
        {
          success: false,
          code: "RESEND_INVITE_FAILED",
          message: resetError.message || "Opnieuw uitnodigen is mislukt.",
        },
        500,
      );
    }

    return jsonResponse({
      success: true,
      message: "Uitnodiging is opnieuw verzonden.",
      member: {
        id: memberProfile.id,
        full_name: memberProfile.full_name,
        email: memberProfile.email,
        role: memberProfile.role,
        status: memberProfile.status,
      },
    });
  } catch (error) {
    console.error("Onverwachte fout in resend-member-invite:", error);

    return jsonResponse(
      {
        success: false,
        code: "UNEXPECTED_ERROR",
        message: "Er is een onverwachte fout opgetreden.",
      },
      500,
    );
  }
});