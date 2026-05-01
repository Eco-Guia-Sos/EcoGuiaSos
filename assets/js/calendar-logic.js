/* assets/js/calendar-logic.js */
import { sanitize } from './ui-utils.js';

let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let allEvents = [];

export function setupCalendar(events) {
    allEvents = events.filter(p => p.tipo === 'evento');
    
    const btnPrev = document.getElementById('calendar-prev-month');
    const btnNext = document.getElementById('calendar-next-month');
    const overlay = document.getElementById('event-sheet-overlay');

    if (btnPrev) btnPrev.onclick = () => changeMonth(-1);
    if (btnNext) btnNext.onclick = () => changeMonth(1);
    if (overlay) overlay.onclick = closeEventSheet;

    renderCalendar();
}

function changeMonth(delta) {
    currentMonth += delta;
    if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    } else if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    }
    renderCalendar();
}

function renderCalendar() {
    const monthYearLabel = document.getElementById('calendar-month-year');
    const daysGrid = document.getElementById('calendar-days-grid');
    if (!monthYearLabel || !daysGrid) return;

    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    monthYearLabel.textContent = `${monthNames[currentMonth]} ${currentYear}`;

    daysGrid.innerHTML = '';

    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    // Rellenar días vacíos del mes anterior
    for (let i = 0; i < firstDay; i++) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'calendar-day empty';
        daysGrid.appendChild(emptyDiv);
    }

    const today = new Date();

    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayEvents = allEvents.filter(ev => {
            if (!ev.fecha) return false;
            // Manejar diferentes formatos de fecha (YYYY-MM-DD o ISO)
            const evDate = new Date(ev.fecha);
            return evDate.getFullYear() === currentYear && 
                   evDate.getMonth() === currentMonth && 
                   evDate.getDate() === day;
        });

        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day';
        if (today.getFullYear() === currentYear && today.getMonth() === currentMonth && today.getDate() === day) {
            dayDiv.classList.add('today');
        }

        dayDiv.innerHTML = `<span class="calendar-day-number">${day}</span>`;

        if (dayEvents.length === 1) {
            dayDiv.classList.add('has-single-event');
            const img = document.createElement('img');
            img.src = dayEvents[0].imagen || '/assets/img/kpop.webp';
            img.className = 'event-image-bg';
            dayDiv.appendChild(img);
        } else if (dayEvents.length > 1) {
            dayDiv.classList.add('has-multiple-events');
            dayDiv.innerHTML += `<span class="event-count-badge">${dayEvents.length} eventos</span>`;
        }

        if (dayEvents.length > 0) {
            dayDiv.onclick = () => openEventSheet(dateStr, dayEvents);
        }

        daysGrid.appendChild(dayDiv);
    }
}

function openEventSheet(dateStr, events) {
    const sheet = document.getElementById('event-sheet');
    const overlay = document.getElementById('event-sheet-overlay');
    const title = document.getElementById('sheet-date-title');
    const list = document.getElementById('sheet-event-list');

    if (!sheet || !list) return;

    // Formatear fecha legible
    const dateObj = new Date(dateStr + 'T00:00:00');
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    title.textContent = dateObj.toLocaleDateString('es-ES', options);

    list.innerHTML = '';
    events.forEach(ev => {
        const item = document.createElement('div');
        item.className = 'sheet-event-item';
        
        item.innerHTML = `
            <img src="${ev.imagen || '/assets/img/kpop.webp'}" alt="${sanitize(ev.nombre)}">
            <div class="sheet-event-content">
                <h4>${sanitize(ev.nombre)}</h4>
                <p>
                    <i class="fa-solid fa-location-dot"></i> ${sanitize(ev.ubicacion || 'Ubicación no disponible')}
                </p>
                <span class="event-category-badge">${sanitize(ev.categoria || 'Evento')}</span>
            </div>
        `;
        item.onclick = () => window.location.href = `./pages/eventos.html?id=${ev.id}`;
        list.appendChild(item);
    });

    sheet.classList.add('active');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden'; // Bloquear scroll
}

function closeEventSheet() {
    const sheet = document.getElementById('event-sheet');
    const overlay = document.getElementById('event-sheet-overlay');
    if (sheet) sheet.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
    document.body.style.overflow = '';
}
