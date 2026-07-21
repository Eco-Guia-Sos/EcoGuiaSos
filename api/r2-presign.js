const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { createClient } = require("@supabase/supabase-js");

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf"
]);

const MIME_EXTENSIONS = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "application/pdf": ".pdf"
};

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    // 1. Exigir cabecera Bearer Token de autorización
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Autorización requerida. Token no proporcionado." });
    }

    const token = authHeader.split(" ")[1];
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return res.status(500).json({ error: "Configuración de autenticación del servidor incompleta." });
    }

    // 2. Validar JWT directamente con Supabase
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(403).json({ error: "Sesión inválida o expirada." });
    }

    // 3. Validar MIME/Tipo de archivo
    const contentType = req.query.contentType || req.body?.contentType;
    if (!contentType || !ALLOWED_MIME_TYPES.has(contentType)) {
      return res.status(400).json({ error: "Tipo de archivo no permitido. Solo se aceptan imágenes y PDFs." });
    }

    // 4. Generar nombre de archivo único y seguro en el servidor (nunca filename arbitrario)
    const ext = MIME_EXTENSIONS[contentType] || ".bin";
    const secureFilename = `uploads/${user.id}/${Date.now()}_${Math.random().toString(36).substring(2, 10)}${ext}`;

    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucketName = process.env.R2_BUCKET_NAME;

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
      return res.status(500).json({ error: "Configuración de almacenamiento R2 incompleta en el servidor." });
    }

    const s3 = new S3Client({
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      region: "auto",
    });

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: secureFilename,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
    const publicUrl = `${process.env.R2_PUBLIC_URL || `https://${bucketName}.${accountId}.r2.dev`}/${secureFilename}`;

    return res.status(200).json({
      uploadUrl,
      publicUrl,
      filename: secureFilename
    });
  } catch (error) {
    console.error("Error al generar URL presignada R2:", error);
    return res.status(500).json({ error: error.message });
  }
};
