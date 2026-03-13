/* assets/js/supabase.js */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fgwmondrylktuuskkstw.supabase.co';
const supabaseKey = 'sb_publishable_K0ubmadq58MK2PfN1nAVtQ__Ugj_7fZ';

// Initialize the Supabase client
export const supabase = createClient(supabaseUrl, supabaseKey);
