/* assets/js/supabase.js */
import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
export const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("FALTAN VARIABLES DE ENTORNO DE SUPABASE. Por favor, configúralas en el Dashboard de Vercel.");
}

// Initialize the Supabase client with Fetch interceptor for debugging
const mockClient = {
    from: () => ({
        select: () => Promise.resolve({ data: [], error: { message: "Supabase no configurado" } }),
        insert: () => Promise.resolve({ data: null, error: { message: "Supabase no configurado" } }),
        update: () => Promise.resolve({ data: null, error: { message: "Supabase no configurado" } }),
        delete: () => Promise.resolve({ data: null, error: { message: "Supabase no configurado" } }),
        single: () => Promise.resolve({ data: null, error: { message: "Supabase no configurado" } })
    }),
    auth: {
        getSession: () => Promise.resolve({ data: { session: null }, error: null }),
        getUser: () => Promise.resolve({ data: { user: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        signOut: () => Promise.resolve({ error: null })
    }
};

export const supabase = (supabaseUrl && supabaseKey) 
    ? createClient(supabaseUrl, supabaseKey, {
        auth: {
            // Cambiar la llave de almacenamiento fuerza a Supabase a 
            // crear una sesión "limpia" y romper el candado del navegador anterior
            storageKey: 'ecoguia-auth-token',
            autoRefreshToken: true,
            persistSession: true
        }
    })
    : mockClient;
