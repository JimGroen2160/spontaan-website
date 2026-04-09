// Supabase client basis (nog geen login / auth logica)

const SUPABASE_URL = 'https://wqtpngqematpnswetxxj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_HZFlCh-O1XyjGVAVlUAUFA_OfNmlApL'

// Supabase v2 gebruikt global 'supabase'
if (!window.supabase) {
  console.error('Supabase library niet geladen');
} else {
  // JUISTE manier voor v2
  const { createClient } = window.supabase;

  window.supabaseClient = createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );

  console.log('Supabase client succesvol geïnitialiseerd');
}