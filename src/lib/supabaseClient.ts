import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// logs TEMPORÁRIOS (aparecem no build da Vercel)
console.log("[ENV] NEXT_PUBLIC_SUPABASE_URL =", supabaseUrl ? "OK" : "MISSING");
console.log("[ENV] NEXT_PUBLIC_SUPABASE_ANON_KEY =", supabaseAnonKey ? "OK" : "MISSING");

export const supabase = createClient(
  supabaseUrl || "http://localhost:54321", // fallback só pra não quebrar build
  supabaseAnonKey || "anon-key-placeholder"
);