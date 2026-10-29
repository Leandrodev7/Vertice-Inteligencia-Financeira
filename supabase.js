const SUPABASE_URL = "https://iczggljjiqzvegrwoztw.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Js_K9_Sxz_JNIlZuHjWN_w_5Z2vUnBg";

if (!window.supabase) {
  console.error("Biblioteca do Supabase não foi carregada.");
} else {
  window.verticeSupabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
  );

  console.log("Configuração do Vértice preparada.");
}
