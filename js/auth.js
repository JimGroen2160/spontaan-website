// Supabase client

const SUPABASE_URL = 'https://wqtpngqematpnswetxxj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_HZFlCh-O1XyjGVAVlUAUFA_OfNmlApL';

const { createClient } = window.supabase;

const supabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

console.log('Supabase client succesvol geïnitialiseerd');

// LOGIN LOGICA

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorEl = document.getElementById('error');

    errorEl.textContent = '';

    const { error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      errorEl.textContent = error.message;
      return;
    }

    // Succes → redirect
    window.location.href = '../index.html';
  });
});