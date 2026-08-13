function resolveSupabaseBrowserConfig() {
  const runtimeConfig = window.SpontaanRuntimeConfig;
  const supabaseConfig = runtimeConfig?.supabase;

  if (!runtimeConfig || !supabaseConfig) {
    throw new Error("Supabase runtimeconfig ontbreekt");
  }

  const supabaseUrl = supabaseConfig.url?.trim();
  const supabaseKey = supabaseConfig.publishableKey?.trim();

  if (!supabaseUrl) {
    throw new Error("Supabase URL ontbreekt");
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(supabaseUrl);
  } catch {
    throw new Error("Ongeldige Supabase URL");
  }

  if (parsedUrl.protocol !== 'https:') {
    throw new Error("Supabase URL moet HTTPS gebruiken");
  }

  if (parsedUrl.username || parsedUrl.password) {
    throw new Error("Supabase URL mag geen credentials bevatten");
  }
  if (!supabaseKey || !supabaseKey.startsWith('sb_publishable_')) {
    throw new Error("Ongeldige Supabase publishable key");
  }

  return {
    url: parsedUrl.origin,
    publishableKey: supabaseKey,
  };
}

const {
  url: SUPABASE_URL,
  publishableKey: SUPABASE_KEY,
} = resolveSupabaseBrowserConfig();

function ensureSupabaseClient() {
  if (!window.supabase) {
    throw new Error("Supabase library niet geladen");
  }

  if (!window.supabaseClient) {
    const { createClient } = window.supabase;
    window.supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);
  }

  return window.supabaseClient;
}

async function getCurrentSession() {
  const client = ensureSupabaseClient();
  const { data, error } = await client.auth.getSession();

  if (error) {
    throw error;
  }

  return data.session;
}

async function getCurrentProfile() {
  const client = ensureSupabaseClient();
  const session = await getCurrentSession();

  if (!session?.user?.id) {
    return null;
  }

  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('auth_user_id', session.user.id)
    .single();

  if (error) {
    console.warn("Profiel niet gevonden of niet leesbaar:", error.message);
    return null;
  }

  return data;
}

async function login(email, password) {
  const client = ensureSupabaseClient();
  return await client.auth.signInWithPassword({ email, password });
}

async function logout() {
  const client = ensureSupabaseClient();
  return await client.auth.signOut();
}

window.authHelpers = {
  supabaseUrl: SUPABASE_URL,
  supabaseKey: SUPABASE_KEY,
  ensureSupabaseClient,
  getCurrentSession,
  getCurrentProfile,
  login,
  logout
};

window.addEventListener("load", () => {
  try {
    ensureSupabaseClient();
    console.log("Auth centralisatie actief");
  } catch (error) {
    console.error("Fout bij initialiseren auth:", error);
  }
});