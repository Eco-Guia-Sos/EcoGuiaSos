/* assets/js/supabase.js */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("FALTAN VARIABLES DE ENTORNO DE SUPABASE. Por favor, configúralas en el Dashboard de Vercel.");
}

// Initialize the Supabase client
export const supabase = (supabaseUrl && supabaseKey) 
    ? createClient(supabaseUrl, supabaseKey)
    : { from: () => ({ select: () => ({ data: [], error: { message: "Supabase no configurado" } }) }) };
