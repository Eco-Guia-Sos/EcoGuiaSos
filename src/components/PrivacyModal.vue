<script setup lang="ts">
defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()
</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen" class="privacy-modal-backdrop" @click.self="emit('close')">
      <div class="privacy-modal-card glass-effect">
        <header class="privacy-modal-header">
          <div class="header-title-group">
            <div class="shield-badge">
              <i class="fa-solid fa-shield-halved"></i>
            </div>
            <div>
              <h3>Aviso de Privacidad y Protección de Datos</h3>
              <p>Cumplimiento con la LFPDPPP (México)</p>
            </div>
          </div>
          <button class="close-btn" @click="emit('close')" aria-label="Cerrar">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </header>

        <div class="privacy-modal-body">
          <section class="privacy-section">
            <h4>1. Responsable del Tratamiento de Datos</h4>
            <p>
              <strong>EcoGuía SOS</strong> es responsable del tratamiento de los datos personales proporcionados por sus usuarios, colectivos y organizaciones afiliadas, garantizando su privacidad y protección en estricto apego a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP).
            </p>
          </section>

          <section class="privacy-section">
            <h4>2. Datos Personales Recabados</h4>
            <p>Para la prestación de los servicios de la plataforma, recabamos los siguientes datos:</p>
            <ul>
              <li><strong>Usuarios / Voluntarios:</strong> Nombre completo, correo electrónico, número telefónico (WhatsApp), foto de perfil (opcional) y redes sociales compartidas.</li>
              <li><strong>Actores / Organizaciones:</strong> Datos de la organización, biografía, enlaces a redes sociales, videos de presentación y zonas de impacto comunitario.</li>
            </ul>
          </section>

          <section class="privacy-section">
            <h4>3. Finalidad del Uso de los Datos</h4>
            <p>Sus datos personales son recabados con las siguientes finalidades primarias:</p>
            <ul>
              <li>Gestión de acceso e identidad en la plataforma.</li>
              <li>Coordinación de actividades comunitarias, eventos ecológicos y voluntariados.</li>
              <li>Envío de notificaciones y alertas sobre causas ambientales de su interés.</li>
              <li>Verificación de autenticidad para cuentas de actores socioambientales.</li>
            </ul>
            <p><em>En ningún caso comercializamos, rentamos ni vendemos información personal a terceros.</em></p>
          </section>

          <section class="privacy-section">
            <h4>4. Derechos ARCO y Mecanismos de Contacto</h4>
            <p>
              Usted tiene derecho a ejercer sus derechos de <strong>Acceso, Rectificación, Cancelación y Oposición (ARCO)</strong> en cualquier momento. Puede modificar sus datos desde su panel de perfil o solicitar la eliminación total de su cuenta escribiendo a nuestro canal de soporte de datos personales.
            </p>
          </section>
        </div>

        <footer class="privacy-modal-footer">
          <button class="btn btn-primary privacy-accept-btn" @click="emit('close')">
            <i class="fa-solid fa-check"></i> Entendido
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.privacy-modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(11, 19, 41, 0.85);
  backdrop-filter: blur(8px);
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.privacy-modal-card {
  background: #0f172a;
  border: 1px solid rgba(114, 176, 77, 0.3);
  border-radius: 20px;
  max-width: 650px;
  width: 100%;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
  overflow: hidden;
}

.privacy-modal-header {
  padding: 20px 25px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(30, 41, 59, 0.5);
}

.header-title-group {
  display: flex;
  align-items: center;
  gap: 15px;
}

.shield-badge {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: rgba(114, 176, 77, 0.15);
  border: 1px solid rgba(114, 176, 77, 0.4);
  color: #72b04d;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
}

.header-title-group h3 {
  color: #ffffff;
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
}

.header-title-group p {
  color: #94a3b8;
  margin: 2px 0 0 0;
  font-size: 0.8rem;
}

.close-btn {
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 1.2rem;
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.close-btn:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.1);
}

.privacy-modal-body {
  padding: 25px;
  overflow-y: auto;
  color: #cbd5e1;
  font-size: 0.9rem;
  line-height: 1.6;
}

.privacy-section {
  margin-bottom: 20px;
}

.privacy-section h4 {
  color: #72b04d;
  font-size: 0.95rem;
  margin: 0 0 8px 0;
  font-weight: 700;
}

.privacy-section p {
  margin: 0 0 8px 0;
}

.privacy-section ul {
  margin: 5px 0 10px 20px;
  padding: 0;
}

.privacy-section li {
  margin-bottom: 5px;
}

.privacy-modal-footer {
  padding: 15px 25px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  justify-content: flex-end;
  background: rgba(15, 23, 42, 0.8);
}

.privacy-accept-btn {
  background: #72b04d;
  color: #ffffff;
  border: none;
  padding: 10px 24px;
  border-radius: 50px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: background 0.2s ease;
}

.privacy-accept-btn:hover {
  background: #5b933d;
}
</style>
