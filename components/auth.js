// components/auth.js

document.addEventListener("DOMContentLoaded", async () => {

    const SUPABASE_URL = "https://wqtpngqematpnswetxxj.supabase.co";
    const SUPABASE_ANON_KEY = "sb_publishable_HZFlCh-O1XyjGVAVlUAUFA_OfNmlApL";
  
    const { createClient } = supabase;
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
    console.log("Supabase client gestart");
  
    const form = document.getElementById("login-form");
  
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
  
        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;
  
        const { data, error } = await supabaseClient.auth.signInWithPassword({
          email,
          password
        });
  
        if (error) {
          document.getElementById("error").innerText = error.message;
        } else {
          window.location.href = "/leden/dashboard.html";
        }
      });
    }
  
  });