import{s as m,a as f,b as g,c as v}from"./ui-utils-NbjfHPK5.js";/* empty css                       */import{s as h}from"./supabase-DHz-HILY.js";async function p(){m();const t=document.getElementById("voluntariados-container");if(t){f("voluntariados-container","Cargando voluntariados desde la base de datos...");try{const{data:r,error:o}=await h.from("voluntariados").select("*").order("created_at",{ascending:!1});if(o)throw o;if(t.innerHTML="",!r||r.length===0){g("voluntariados-container","Aún no hay voluntariados registrados. ¡Vuelve pronto!");return}r.forEach(a=>{const n=a.nombre,e=a.ubicacion||"Ubicación por confirmar",i=a.fecha||"Próximamente",c=a.imagen||"/assets/img/ajolote.webp",l=a.link||"#",s=a.mapa_url||"",d=s?`<a href="${s}" target="_blank" style="color:#ccc; text-decoration:underline;">${e}</a>`:e,u=`
                <article class="voluntariado-card generic-card fade-in">
                    <img src="${c}" alt="${n}" class="v-img" onerror="this.src='/assets/img/ajolote.webp'">
                    <div class="v-content">
                        <h3>${n}</h3>
                        <div class="v-tag"><i class="fa-solid fa-location-dot"></i> ${d}</div>
                        <div class="v-tag"><i class="fa-regular fa-calendar"></i> ${i}</div>
                        <a href="${l}" class="btn-action-main" target="_blank" style="align-self: flex-start; margin-top: 15px;">Participar</a>
                    </div>
                </article>
            `;t.innerHTML+=u})}catch(r){console.error("Error fetching voluntariados:",r),v("voluntariados-container","Hubo un error cargando los datos de voluntariados. Verifica la conexión.")}}}document.addEventListener("DOMContentLoaded",p);
