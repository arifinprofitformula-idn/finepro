// src/lib/supabaseClient.js
// Kredensial dibaca dari .env (aman, tidak ter-commit ke Git),
// bukan hardcode seperti config.js pada versi single-file sebelumnya.

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Kredensial Supabase belum diisi. Salin .env.example ke .env dan isi nilainya."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
