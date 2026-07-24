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
    <div v-if="isOpen" class="levels-modal-backdrop" @click.self="emit('close')">
      <div class="levels-modal-card glass-effect">
        <header class="levels-modal-header">
          <div class="header-title-group">
            <div class="leaf-badge">
              <i class="fa-solid fa-seedling"></i>
            </div>
            <div>
              <h3>Niveles EcoGuía SOS</h3>
              <p>Clasificación temática de contenidos y acción socioambiental</p>
            </div>
          </div>
          <button class="close-btn" @click="emit('close')" aria-label="Cerrar">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </header>

        <div class="levels-modal-body">
          <p class="levels-intro">
            Organizamos toda la información y oportunidades de la plataforma en <strong>tres niveles temáticos</strong> inspirados en la fauna nativa de México, adaptados al tipo de participación que buscas:
          </p>

          <div class="levels-grid">
            <!-- NIVEL COLIBRÍ -->
            <article class="level-card level-colibri">
              <header class="level-card-header">
                <span class="level-icon">🐦</span>
                <div>
                  <h4>Nivel Colibrí (Polinización)</h4>
                  <span class="level-subtitle">Cultura, Aprendizaje & Conocimiento Sustentable</span>
                </div>
              </header>
              <div class="level-card-content">
                <p>
                  Educación ambiental, herramientas ecológicas cotidianas, recursos científicos y difusión cultural.
                </p>
                <div class="level-tags">
                  <span class="tag">🎓 Cursos</span>
                  <span class="tag">💡 Ecotecnias</span>
                  <span class="tag">🌊 Agua</span>
                  <span class="tag">📚 Lecturas</span>
                  <span class="tag">🎥 Documentales</span>
                  <span class="tag">✍️ Firmas</span>
                  <span class="tag">🔌 Eco-Tecnología</span>
                </div>
              </div>
            </article>

            <!-- NIVEL AJOLOTE -->
            <article class="level-card level-ajolote">
              <header class="level-card-header">
                <span class="level-icon">🦎</span>
                <div>
                  <h4>Nivel Ajolote (Regeneración)</h4>
                  <span class="level-subtitle">Comunidad, Acción Directa & Territorio</span>
                </div>
              </header>
              <div class="level-card-content">
                <p>
                  Participación comunitaria directa en el territorio, convocatorias, lugares sustentables y voluntariado.
                </p>
                <div class="level-tags">
                  <span class="tag">👥 Agentes</span>
                  <span class="tag">📣 Convocatorias</span>
                  <span class="tag">🤝 Ayuda / Voluntariado</span>
                  <span class="tag">💝 Causas & Rifas</span>
                  <span class="tag">🌿 Lugares</span>
                  <span class="tag">🏆 Eventos Especiales</span>
                </div>
              </div>
            </article>

            <!-- NIVEL LOBO -->
            <article class="level-card level-lobo">
              <header class="level-card-header">
                <span class="level-icon">🐺</span>
                <div>
                  <h4>Nivel Lobo (Estrategia)</h4>
                  <span class="level-subtitle">Financiamiento, Estructura & Normatividad</span>
                </div>
              </header>
              <div class="level-card-content">
                <p>
                  Fortalecimiento de proyectos socioambientales, marco legal y convocatorias de financiamiento.
                </p>
                <div class="level-tags">
                  <span class="tag">💰 Fondos & Apoyos</span>
                  <span class="tag">⚖️ Normativa Ambiental</span>
                </div>
              </div>
            </article>
          </div>
        </div>

        <footer class="levels-modal-footer">
          <button class="btn btn-primary levels-accept-btn" @click="emit('close')">
            <i class="fa-solid fa-compass"></i> Explorar Catálogo
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.levels-modal-backdrop {
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

.levels-modal-card {
  background: #0f172a;
  border: 1px solid rgba(114, 176, 77, 0.3);
  border-radius: 20px;
  max-width: 720px;
  width: 100%;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
  overflow: hidden;
}

.levels-modal-header {
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

.leaf-badge {
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
  font-size: 1.15rem;
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

.levels-modal-body {
  padding: 25px;
  overflow-y: auto;
  color: #cbd5e1;
}

.levels-intro {
  margin: 0 0 20px 0;
  font-size: 0.92rem;
  line-height: 1.5;
  color: #94a3b8;
}

.levels-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.level-card {
  background: rgba(30, 41, 59, 0.4);
  border-radius: 14px;
  padding: 18px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  transition: transform 0.2s ease, border-color 0.2s ease;
}

.level-colibri {
  border-left: 4px solid #72b04d;
}

.level-ajolote {
  border-left: 4px solid #0077b6;
}

.level-lobo {
  border-left: 4px solid #94a3b8;
}

.level-card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

.level-icon {
  font-size: 1.6rem;
}

.level-card-header h4 {
  margin: 0;
  color: #ffffff;
  font-size: 1rem;
  font-weight: 700;
}

.level-subtitle {
  font-size: 0.75rem;
  color: #72b04d;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.level-ajolote .level-subtitle {
  color: #38bdf8;
}

.level-lobo .level-subtitle {
  color: #cbd5e1;
}

.level-card-content p {
  margin: 0 0 12px 0;
  font-size: 0.85rem;
  line-height: 1.5;
  color: #cbd5e1;
}

.level-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #cbd5e1;
  font-size: 0.73rem;
  padding: 3px 10px;
  border-radius: 50px;
  font-weight: 500;
}

.levels-modal-footer {
  padding: 15px 25px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  justify-content: flex-end;
  background: rgba(15, 23, 42, 0.8);
}

.levels-accept-btn {
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

.levels-accept-btn:hover {
  background: #5b933d;
}
</style>
