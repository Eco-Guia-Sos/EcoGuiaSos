import { GoogleGenerativeAI } from "@google/generative-ai";

// Configuración de la API (Uso de variables de entorno)
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!API_KEY) {
    console.warn("VITE_GEMINI_API_KEY no encontrada. El chat de IA no funcionará hasta que se configure en Vercel.");
}

const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY, { apiVersion: "v1" }) : null;

const SYSTEM_PROMPT = `
Eres el Asistente Inteligente de EcoGuía SOS, una plataforma dedicada a promover la sustentabilidad y eventos ecológicos en la Ciudad de México.
Tu objetivo es ayudar a los usuarios a encontrar talleres, voluntariados, charlas y lugares sustentables (huertos, centros de reciclaje, etc.).

Contexto del proyecto:
- Misión: Conectar a personas con acciones positivas por el planeta.
- Secciones: Inicio, Nosotros, Cursos, Ecotecnias, Agentes, Voluntariados, Fondos, Normativa, Agua, Lecturas, Documentales, Firmas.
- Dashboard: El usuario puede filtrar eventos por categoría, ubicación y proximidad.

Pautas de respuesta:
1. Sé amable, proactivo y entusiasta sobre la ecología.
2. Si te preguntan sobre eventos, menciónales que pueden usar la "Búsqueda Avanzada" en el sitio para resultados precisos.
3. Puedes dar consejos sobre ecotecnias (captura de lluvia, compostaje, etc.).
4. Si no sabes algo específico sobre un evento real (ya que no tienes acceso a la DB en tiempo real directo aquí), guíalos hacia el mapa o la cartelera.

Responde de manera concisa y usa emojis cuando sea apropiado. 🌿🌎
`;

let chatSession = null;

export function initAIAssistant() {
    setupChatUI();
}

function setupChatUI() {
    const chatContainer = document.createElement('div');
    chatContainer.id = 'ai-chat-wrapper';
    chatContainer.innerHTML = `
        <button id="ai-chat-bubble">
            <i class="fas fa-robot"></i>
        </button>
        <div id="ai-chat-window" class="hidden">
            <div class="chat-header">
                <h3><i class="fas fa-leaf"></i> EcoAsistente</h3>
                <button id="close-chat">&times;</button>
            </div>
            <div id="chat-messages">
                <div class="message system">¡Hola! Soy tu asistente de EcoGuía SOS. ¿En qué puedo ayudarte hoy? 🌿</div>
            </div>
            <div class="chat-input-area">
                <input type="text" id="chat-input" placeholder="Pregunta algo sobre ecología...">
                <button id="send-chat"><i class="fas fa-paper-plane"></i></button>
            </div>
        </div>
    `;
    document.body.appendChild(chatContainer);

    const bubble = document.getElementById('ai-chat-bubble');
    const window = document.getElementById('ai-chat-window');
    const closeBtn = document.getElementById('close-chat');
    const sendBtn = document.getElementById('send-chat');
    const input = document.getElementById('chat-input');

    bubble.addEventListener('click', () => {
        window.classList.toggle('hidden');
        if (!window.classList.contains('hidden')) {
            input.focus();
        }
    });

    closeBtn.addEventListener('click', () => {
        window.classList.add('hidden');
    });

    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
}

async function sendMessage() {
    const input = document.getElementById('chat-input');
    const container = document.getElementById('chat-messages');
    const text = input.value.trim();

    if (!text) return;

    // Agregar mensaje del usuario
    appendMessage('user', text);
    input.value = '';

    // Mostrar loader
    const loaderId = appendMessage('model', 'Escribiendo...', true);

    try {
        if (!chatSession) {
            // Usamos 1.5-flash que es más estable con la API v1 estándar
            const model = genAI.getGenerativeModel({ 
                model: "gemini-1.5-flash",
                systemInstruction: SYSTEM_PROMPT
            });
            chatSession = model.startChat();
        }

        const result = await chatSession.sendMessage(text);
        const response = await result.response;
        const responseText = response.text();

        // Reemplazar loader con respuesta real
        updateMessage(loaderId, responseText);
    } catch (error) {
        console.error("Error detallado de Gemini:", error);
        let errorMsg = "Lo siento, tuve un problema al conectar con mi cerebro artificial. 🧠💨";
        
        if (error.message && error.message.includes("404")) {
            errorMsg += " (Error 404: El modelo no fue encontrado. Intentando ajustar configuración...)";
        }
        
        updateMessage(loaderId, errorMsg);
    }

    container.scrollTop = container.scrollHeight;
}

function appendMessage(role, text, isLoader = false) {
    const container = document.getElementById('chat-messages');
    const div = document.createElement('div');
    const id = 'msg-' + Date.now();
    div.id = id;
    div.className = `message ${role}`;
    div.innerText = text;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    return id;
}

function updateMessage(id, text) {
    const msg = document.getElementById(id);
    if (msg) {
        msg.innerText = text;
        msg.classList.remove('loading');
    }
}
