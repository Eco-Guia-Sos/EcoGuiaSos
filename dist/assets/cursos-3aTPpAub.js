import{s as f,a as m,b as p,c as g}from"./ui-utils-NbjfHPK5.js";/* empty css                       */import{s as u}from"./supabase-DHz-HILY.js";async function h(){f();const r=document.getElementById("cursos-container");if(r){m("cursos-container","Buscando ofertas educativas...");try{const{data:s,error:n}=await u.from("cursos").select("*").order("created_at",{ascending:!1});if(n)throw n;if(r.innerHTML="",!s||s.length===0){p("cursos-container","Aún no hay cursos programados.");return}s.forEach(a=>{const c=a.organiza||"EcoGuía SOS",i=a.fecha||"Por definir",o=a.modalidad||"Presencial",e=a.imagen||"/assets/img/colibri.webp",t=a.link||"#",d=a.descripcion?`<p class="c-desc">${a.descripcion}</p>`:"",l=`
                <article class="curso-card generic-card fade-in">
                    <img src="${e}" alt="${a.nombre}" class="c-img" onerror="this.src='/assets/img/colibri.webp'">
                    <div class="c-content">
                        <h3>${a.nombre}</h3>
                        <div class="c-info">
                            <span><i class="fa-solid fa-graduation-cap"></i> ${c}</span>
                        </div>
                        <div class="c-info">
                            <span><i class="fa-regular fa-calendar"></i> ${i}</span>
                            <span><i class="fa-solid fa-laptop-code"></i> ${o}</span>
                        </div>
                        ${d}
                        <a href="${t}" class="btn-action-main" target="_blank">Inscribirse</a>
                    </div>
                </article>
            `;r.innerHTML+=l})}catch(s){console.error("Error fetching cursos:",s),g("cursos-container","Error al cargar cursos. Verifica tu conexión a la base de datos.")}}}document.addEventListener("DOMContentLoaded",h);
