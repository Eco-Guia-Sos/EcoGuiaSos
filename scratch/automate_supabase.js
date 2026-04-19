
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Leer el archivo .env manualmente
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) env[key.trim()] = value.trim();
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("❌ Faltan llaves en el .env para la automatización.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runAutomation() {
    console.log("🚀 Iniciando automatización en Supabase...");

    // Nota: El SDK de Supabase no permite ejecutar SQL arbitrario (DDL) directamente por seguridad.
    // Sin embargo, puedo usarlo para crear datos de prueba y verificar la conexión.
    
    try {
        const { data, error } = await supabase.from('perfiles').select('count', { count: 'exact' });
        if (error) throw error;
        console.log(`✅ Conexión exitosa. Tienes ${data.length} perfiles.`);
        
        // Aquí podría insertar datos de prueba si quisiéramos
    } catch (err) {
        console.error("❌ Error en la conexión:", err.message);
    }
}

runAutomation();
