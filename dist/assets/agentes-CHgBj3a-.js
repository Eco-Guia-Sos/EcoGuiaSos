import{s as b,a as h,b as $,c as _}from"./ui-utils-NbjfHPK5.js";/* empty css                       */import{s as w}from"./supabase-DHz-HILY.js";async function u(){b();const r=document.getElementById("agentes-container");if(r){h("agentes-container","Buscando líderes ambientales comunitarios...");try{const{data:s,error:t}=await w.from("agentes").select("*").order("created_at",{ascending:!1});if(t)throw t;if(r.innerHTML="",!s||s.length===0){$("agentes-container","Aún no hay agentes registrados.");return}s.forEach(a=>{const o=a.nombre,n=a.categoria||a.especialidad||"Ambientalista",f=a.organizacion||"Independiente",g=a.imagen||"/assets/img/kpop.webp",c=a.zona||"",i=a.alcaldia||"",d=a.descripcion||"",l=a.mapa_url||"";let e="";a.redes_ig&&(e+=`<a href="${a.redes_ig}" target="_blank" title="Instagram"><i class="fa-brands fa-instagram"></i></a>`),a.redes_fb&&(e+=`<a href="${a.redes_fb}" target="_blank" title="Facebook"><i class="fa-brands fa-facebook"></i></a>`),a.redes_x&&(e+=`<a href="${a.redes_x}" target="_blank" title="X"><i class="fa-brands fa-x-twitter"></i></a>`),a.redes_web&&(e+=`<a href="${a.redes_web}" target="_blank" title="Web"><i class="fa-solid fa-globe"></i></a>`),a.redes_wa&&(e+=`<a href="https://wa.me/${a.redes_wa.replace(/\D/g,"")}" target="_blank" title="WhatsApp"><i class="fa-brands fa-whatsapp"></i></a>`);const m=l?`<a href="${l}" target="_blank" class="agente-org" style="text-decoration:underline;"><i class="fa-solid fa-location-dot"></i> ${i||c||"Ver Mapa"}</a>`:`<div class="agente-org"><i class="fa-solid fa-location-dot"></i> ${i||c||"Varias zonas"}</div>`,p=`
                <article class="agente-card generic-card fade-in" data-alcaldia="${i}" data-categoria="${n}">
                    <img src="${g}" alt="${o}" class="agente-img" onerror="this.src='/assets/img/kpop.webp'">
                    <h3>${o}</h3>
                    <div class="agente-especialidad">${n}</div>
                    <div class="agente-org"><i class="fa-solid fa-users"></i> ${f}</div>
                    ${m}
                    ${d?`<p class="agente-mini-desc">${d}</p>`:""}
                    <div class="agente-socials">
                        ${e}
                    </div>
                </article>
            `;r.innerHTML+=p})}catch(s){console.error("Error fetching agentes:",s),_("agentes-container","Error al cargar agentes. Verifica tu conexión a la base de datos.")}}}document.addEventListener("DOMContentLoaded",u);
