// Supabase client basis (nog geen login / auth logica)

// ⚠️ Vul jouw eigen waarden in
const SUPABASE_URL = 'https://wqtpngqematpnswetxxj.supabase.co';
const SUPABASE_KEY = 'JOUW_PUBLISHABLE_KEY_HIER';

// Controle of Supabase library geladen is
if (!window.supabase) {
  console.error('Supabase library niet geladen');
} else {
  // Client aanmaken
  window.supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );

  console.log('Supabase client succesvol geïnitialiseerd');
}