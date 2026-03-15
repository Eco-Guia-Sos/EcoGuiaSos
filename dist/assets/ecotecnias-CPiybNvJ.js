import{s as l,a as g,b as m,c as p}from"./ui-utils-NbjfHPK5.js";/* empty css                       */import{s as f}from"./supabase-DHz-HILY.js";async function h(){l();const n=document.getElementById("ecotecnias-container");if(n){g("ecotecnias-container","Cargando tecnologías sustentables...");try{const{data:e,error:c}=await f.from("ecotecnias").select("*").order("nombre",{ascending:!0});if(c)throw c;if(n.innerHTML="",!e||e.length===0){m("ecotecnias-container","Aún no hay ecotecnias registradas.");return}e.forEach(a=>{const o=a.nombre,t=a.categoria||"Ecotecnología",r=a.icono||"fa-seedling",i=a.descripcion||"Sin descripción.",s=a.beneficio||"",d=`
                <article class="ecotecnia-card generic-card fade-in">
                    <div class="e-header">
                        <i class="fa-solid ${r} e-icon"></i>
                        <h3 class="e-title">${o}</h3>
                    </div>
                    <p class="e-desc">${i}</p>
                    <div class="e-tags">
                        <span class="e-tag">${t}</span>
                        ${s?`<span class="e-tag">${s}</span>`:""}
                    </div>
                </article>
            `;n.innerHTML+=d})}catch(e){console.error("Error loading ecotecnias:",e),p("ecotecnias-container","Error al cargar ecotecnias.")}}}document.addEventListener("DOMContentLoaded",h);
