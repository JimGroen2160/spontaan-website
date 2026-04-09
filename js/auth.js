// ✅ Supabase client (definitief correct)

const SUPABASE_URL = 'https://wqtpngqematpnswetxxj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_HZFlCh-O1XyjGVAVlUAUFA_OfNmlApL';

// Wachten tot pagina volledig geladen is
window.addEventListener("load", () => {
  console.log("Auth.js geladen");

  if (!window.supabase) {
    console.error("Supabase library niet geladen");
    return;
  }

  try {
    const { createClient } = window.supabase;

    window.supabaseClient = createClient(
      SUPABASE_URL,
      SUPABASE_KEY
    );

    console.log("✅ Supabase client succesvol geïnitialiseerd");
  } catch (e) {
    console.error("Fout bij initialiseren Supabase:", e);
  }
});