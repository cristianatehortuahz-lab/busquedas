/**
 * ============================================================================
 * HUB VIVO - Dashboard de Busqueda v5 (Premium Edition)
 * Universidad del Rosario
 * ============================================================================
 *
 * DESCRIPCION GENERAL:
 *   Este archivo es el motor principal del dashboard de busqueda del HUB
 *   academico de la Universidad del Rosario, construido sobre la plataforma
 *   VIVO (sistema de informacion de investigacion). Su funcion es interceptar
 *   las busquedas del usuario, obtener resultados desde el endpoint nativo
 *   de VIVO (/search) via AJAX, parsear el HTML devuelto, y reconstruir
 *   la interfaz con tarjetas personalizadas y modernas.
 *
 * FLUJO DE DATOS:
 *   1. El usuario realiza una busqueda -> la URL contiene ?querytext=...
 *   2. Este script lee los parametros de la URL (URLSearchParams)
 *   3. Construye URLs de busqueda para 4 categorias (perfiles, organizaciones,
 *      programas, publicaciones), cada una apuntando a un classgroup de VIVO
 *   4. Para cada categoria, hace un fetch AJAX al endpoint /search de VIVO
 *   5. Parsea el HTML de respuesta con DOMParser (extrae la lista <ul.searchhits>)
 *   6. Aplica filtros de tipo, deduplicacion y relevancia sobre los <li>
 *   7. Construye tarjetas HTML personalizadas (cards para personas/orgs,
 *      filas para publicaciones/programas)
 *   8. Renderiza las tarjetas en el DOM con animaciones escalonadas
 *   9. Actualiza badges del sidebar con animacion count-up
 *
 * DECISIONES ARQUITECTONICAS:
 *   - AJAX fetch en lugar de API REST: VIVO no expone una API JSON publica
 *     para busquedas; el unico endpoint disponible es /search que devuelve
 *     HTML. Por eso se usa fetch + DOMParser para extraer datos del HTML.
 *   - sessionStorage como cache: Evita refetches innecesarios durante la
 *     misma sesion del navegador. Se usa btoa() para generar claves unicas
 *     basadas en la URL completa de la consulta.
 *   - Skeleton loaders: Mejoran la percepcion de velocidad mostrando
 *     placeholders animados mientras se cargan los datos via AJAX.
 *   - Deduplicacion global (Set de URLs): Previene que un mismo resultado
 *     aparezca en multiples categorias (ej: una persona que tambien aparece
 *     como parte de una organizacion).
 *   - Deteccion de tipo por DOM: VIVO no siempre envia metadata estructurada;
 *     se inspecciona el HTML de cada resultado para determinar si es persona,
 *     organizacion, programa o publicacion.
 *
 * DEPENDENCIAS:
 *   - Navegador moderno con soporte para: fetch, DOMParser, URLSearchParams,
 *     IntersectionObserver, requestAnimationFrame, sessionStorage
 *   - CSS asociado: dashboardSearch_hub.css (estilos de tarjetas, skeleton,
 *     toolbar, sidebar)
 *   - HTML base: debe existir un layout con id="dashboard-search-layout",
 *     secciones con ids "category-profiles", "category-organizations", etc.,
 *     y un sidebar con id="content-type-menu"
 *   - Variable global opcional: `urls.base` (definida por VIVO en sus
 *     plantillas FTL) para determinar la URL base del sitio
 *
 * INTEGRACION CON EL SISTEMA:
 *   Este script se inyecta en la pagina de resultados de busqueda de VIVO.
 *   Reemplaza la visualizacion nativa de VIVO (listas planas) con un
 *   dashboard categorizado con tarjetas premium, filtros por facultad,
 *   ordenamiento, y navegacion lateral con scrollspy.
 *
 * VERSIONES:
 *   v5 - Count-up animation en badges del sidebar
 *      - Cards con stagger animation (delay escalonado)
 *      - Org cards con flecha lateral
 *      - Skeleton mas limpio y accesible
 *      - Builders mejorados con highlighting de terminos de busqueda
 * ============================================================================
 */

/* ==========================================================================
 * SECCION 1: UTILIDADES GLOBALES
 * Funciones auxiliares que se usan fuera del scope del DOMContentLoaded.
 * ========================================================================== */

/**
 * animateCount - Animacion de conteo progresivo para badges numericos.
 *
 * Implementa una animacion de "count-up" que incrementa visualmente un numero
 * desde 0 hasta el valor objetivo, usando requestAnimationFrame para fluidez.
 * Se usa en los badges del sidebar para dar feedback visual al usuario de que
 * los resultados se estan cargando y cuantos hay.
 *
 * @param {HTMLElement} el      - Elemento DOM donde se mostrara el numero animado
 * @param {number}      target  - Valor numerico final al que se debe llegar
 * @returns {void}
 *
 * Uso: animateCount(badgeElement, 42) -> el badge mostrara 0, 1, 2... 42
 *
 * Arquitectura: Se usa ease-out cubico para que la animacion desacelere al
 * final, dando una sensacion mas natural. La duracion se escala con el valor
 * objetivo (mas grande = mas lento) con un tope de 900ms.
 */
function animateCount(el, target) {
  // Validacion: si el elemento no existe o el target no es numerico, salir
  if (!el || isNaN(target)) return;

  // Calcular duracion adaptativa: minimo 300ms, maximo 900ms
  // Valores grandes tardan un poco mas para dar sensacion de "conteo real"
  const duration = Math.min(900, 300 + target * 0.5);
  const start    = performance.now();
  const from     = 0;

  /**
   * tick - Funcion de animacion por frame.
   * Se llama recursivamente via requestAnimationFrame hasta completar.
   * @param {number} now - Timestamp del frame actual (provisto por rAF)
   */
  function tick(now) {
    // Calcular progreso lineal (0 a 1)
    const progress = Math.min((now - start) / duration, 1);

    // Aplicar curva ease-out cubica: desacelera al acercarse al final
    // Formula: 1 - (1 - t)^3 donde t es el progreso lineal
    const eased    = 1 - Math.pow(1 - progress, 3); // ease-out cubic

    // Interpolar entre 0 y target usando el progreso con easing
    // toLocaleString('es-CO') formatea con separadores de miles colombianos
    el.textContent = Math.round(from + (target - from) * eased).toLocaleString('es-CO');

    // Si no hemos llegado al final, programar el siguiente frame
    if (progress < 1) requestAnimationFrame(tick);
    // Al terminar, asegurar que el valor final sea exacto (sin errores de redondeo)
    else el.textContent = target.toLocaleString('es-CO');
  }

  // Iniciar el ciclo de animacion
  requestAnimationFrame(tick);
}

/* ==========================================================================
 * SECCION 2: INICIALIZACION PRINCIPAL
 * Todo el codigo del dashboard se ejecuta cuando el DOM esta listo.
 * Se encapsula en DOMContentLoaded para garantizar que los elementos HTML
 * ya existen antes de manipularlos.
 * ========================================================================== */
document.addEventListener("DOMContentLoaded", function () {

    /* ----------------------------------------------------------------------
     * 2.1 VALIDACION DEL LAYOUT
     * Verificar que estamos en la pagina correcta (la que tiene el layout
     * del dashboard). Si no existe el contenedor principal, no hacer nada.
     * Esto permite que el script se cargue en todas las paginas sin errores.
     * ---------------------------------------------------------------------- */
    const layout = document.getElementById("dashboard-search-layout");
    if (!layout) return;

    /* ----------------------------------------------------------------------
     * 2.2 LECTURA DE PARAMETROS DE BUSQUEDA
     * Extraer los parametros de la URL actual. Si no hay parametros,
     * significa que el usuario llego a la pagina sin buscar nada;
     * en ese caso, mostrar un mensaje informativo.
     * ---------------------------------------------------------------------- */
    const urlParams = new URLSearchParams(window.location.search);
    if (Array.from(urlParams.keys()).length === 0) {
        // No hay parametros de busqueda: mostrar mensaje al usuario
        const loader = document.getElementById("dashboard-global-loader");
        if (loader) loader.innerHTML = "<p>Realice una b\\u00FAsqueda para ver resultados.</p>";
        return;
    }

    /* ----------------------------------------------------------------------
     * 2.3 OCULTAR LOADER GLOBAL
     * El loader global (spinner/mensaje de carga) se muestra por defecto
     * en el HTML. Una vez que sabemos que hay parametros de busqueda y
     * vamos a procesar resultados, lo ocultamos.
     * ---------------------------------------------------------------------- */
    const loader = document.getElementById("dashboard-global-loader");
    if (loader) loader.style.display = "none";

    // Extraer el texto de busqueda del usuario para uso en highlighting
    const queryText = urlParams.get('querytext') || '';

    /* ----------------------------------------------------------------------
     * 2.4 DETERMINACION DE LA URL BASE
     * VIVO define una variable global `urls.base` en sus plantillas FTL
     * que contiene la ruta base de la aplicacion (ej: "/vivo" o "").
     * Si esa variable no esta disponible (por ejemplo, en entornos de
     * desarrollo o cuando el script se carga antes que VIVO), se usa
     * un fallback que detecta la ruta desde la URL actual.
     * Esto evita el error "ReferenceError: urls is not defined".
     * ---------------------------------------------------------------------- */
    let baseUrl = '';
    if (typeof urls !== 'undefined' && urls.base) {
        // Caso normal: usar la variable global de VIVO
        baseUrl = urls.base;
    } else {
        // Fallback: detectar desde la URL actual (asumiendo que estamos en /search)
        const pathParts = window.location.pathname.split('/search');
        baseUrl = pathParts[0] || '';
    }

    // Construir la URL del endpoint de busqueda de VIVO
    // Asegurar que no haya doble slash: quitar trailing slash si existe
    const SEARCH = (baseUrl.endsWith('/') ? baseUrl.slice(0,-1) : baseUrl) + '/search';

    /* ----------------------------------------------------------------------
     * 2.5 LIMPIEZA Y CONFIGURACION DE PARAMETROS DE BUSQUEDA
     * VIVO agrega parametros propios (classgroup, filters_category, etc.)
     * que interfieren con nuestras consultas por categoria. Los eliminamos
     * y configuramos valores por defecto que necesitamos para todas las
     * consultas AJAX.
     * ---------------------------------------------------------------------- */

    // Eliminar classgroup para poder especificar uno diferente por categoria
    urlParams.delete('classgroup');
    // Eliminar filters_category para evitar que anule nuestra solicitud de categoria
    urlParams.delete('filters_category'); // Importante: Eliminar TODO para evitar anular nuestra solicitud de categoria
    // Reiniciar indice de inicio para obtener resultados desde el principio
    urlParams.delete('startIndex');       // Iniciar desde cero para todas las categorias
    // Solicitar un numero generoso de resultados por pagina
    urlParams.set('hitsPerPage', '100');  // Solicitar suficientes resultados
    // Fijar locale en espanol para obtener snippets consistentes
    urlParams.set('locale', 'es_ES');     // Para snippets de texto estables

    // Guardar los parametros base como string para reutilizar en cada categoria
    const baseQ = urlParams.toString();

    /* ======================================================================
     * SECCION 3: SKELETON LOADERS
     * Los skeleton loaders son placeholders animados que imitan la estructura
     * visual de las tarjetas reales. Se muestran mientras se cargan los datos
     * via AJAX para mejorar la percepcion de velocidad (UX pattern).
     *
     * Por que skeleton en vez de spinner? Los skeletons dan al usuario una
     * idea de QUE tipo de contenido va a aparecer (forma de tarjeta vs fila),
     * reduciendo el "salto" visual cuando llegan los datos reales.
     * ====================================================================== */

    /**
     * showSkeleton - Muestra placeholders animados en una seccion.
     *
     * Genera HTML de tarjetas/filas skeleton con animacion de pulso CSS.
     * Cada skeleton tiene un delay escalonado para crear un efecto de ola.
     *
     * @param {string} sectionId - ID de la seccion del DOM (ej: 'category-profiles')
     * @param {number} count     - Cantidad de skeletons a mostrar
     * @param {string} type      - Tipo de skeleton: 'grid' (tarjeta) o 'list' (fila)
     * @returns {void}
     *
     * Uso: showSkeleton('category-profiles', 4, 'grid')
     */
    function showSkeleton(sectionId, count, type) {
        const section = document.getElementById(sectionId);
        if (!section) return;

        // Hacer visible la seccion (puede estar oculta por defecto)
        section.style.display = 'block';

        // Buscar el contenedor de contenido dentro de la seccion
        // Puede ser un grid (para personas/orgs) o una lista (para publicaciones/programas)
        const parent = section.querySelector('[id^="grid-"],[id^="list-"]');
        if (!parent) return;

        let html = '';
        for (let i = 0; i < count; i++) {
            // Delay escalonado: cada skeleton aparece 120ms despues del anterior
            // Esto crea un efecto de "cascada" visual
            const delay = `animation-delay: ${i * 0.12}s;`;

            if (type === 'grid') {
                // Skeleton tipo tarjeta (grid): replica la estructura visual de una
                // tarjeta de persona -> avatar circular + nombre + cargo + escuela + flecha
                html += `<div class="hub-skeleton-card" style="${delay}" role="status" aria-label="Cargando resultado">
                    <div class="hub-skeleton-avatar"></div>
                    <div class="hub-skeleton-text">
                        <div class="hub-skeleton-line hub-skel-w80"></div>
                        <div class="hub-skeleton-line hub-skel-w60"></div>
                        <div class="hub-skeleton-line hub-skel-w45"></div>
                    </div>
                    <div class="hub-skeleton-arrow"></div>
                </div>`;
            } else {
                // Skeleton tipo fila (list): replica una fila de publicacion/programa
                // con badge de tipo + titulo + subtitulo
                html += `<div class="hub-skeleton-row" style="${delay}" role="status" aria-label="Cargando resultado">
                    <div class="hub-skeleton-line hub-skel-badge"></div>
                    <div class="hub-skeleton-line hub-skel-w85"></div>
                    <div class="hub-skeleton-line hub-skel-w70"></div>
                </div>`;
            }
        }

        // Reemplazar el contenido actual del contenedor con los skeletons
        parent.innerHTML = html;
    }

    /**
     * clearSkeleton - Limpia los skeleton loaders de una seccion.
     *
     * Se llama cuando los datos reales ya estan listos para renderizarse,
     * vaciando el contenedor para que se llene con las tarjetas reales.
     *
     * @param {string} sectionId - ID de la seccion del DOM a limpiar
     * @returns {void}
     */
    function clearSkeleton(sectionId) {
        const section = document.getElementById(sectionId);
        if (!section) return;
        const parent = section.querySelector('[id^="grid-"],[id^="list-"]');
        if (parent) parent.innerHTML = '';
    }

    /* ======================================================================
     * SECCION 4: DETECCION DE TIPO DE RESULTADO
     * VIVO devuelve los resultados como elementos <li> dentro de una lista
     * <ul.searchhits>. Cada <li> puede ser una persona, organizacion,
     * programa o publicacion, pero VIVO no siempre provee metadata clara.
     * Esta funcion inspecciona el DOM de cada <li> para determinar su tipo.
     * ====================================================================== */

    /**
     * detectType - Determina el tipo de un resultado de busqueda.
     *
     * Usa una estrategia de 3 niveles para clasificar cada resultado:
     *   1. Atributo explicito data-vclass (cuando las plantillas FTL estan modificadas)
     *   2. Selectores CSS de clase/estructura (clases conocidas de VIVO)
     *   3. Contenido textual como ultimo recurso
     *
     * @param {HTMLLIElement} li - Elemento <li> de la lista de resultados de VIVO
     * @returns {string} Tipo detectado: 'person', 'org', 'program' o 'publication'
     *
     * Por que 3 niveles? Las plantillas FTL de VIVO pueden estar personalizadas
     * (con data-vclass) o ser las por defecto (sin data-vclass). El fallback
     * por contenido cubre casos edge como "Trabajo de Grado".
     */
    function detectType(li) {
        // --- Nivel 1: Deteccion por atributo explicito (data-vclass) ---
        // Las plantillas FTL modificadas del HUB agregan data-vclass con la URI
        // de la ontologia VIVO (ej: "http://vivoweb.org/ontology#Person")
        const vclassContainer = li.querySelector('[data-vclass]');
        if (vclassContainer) {
            const vclass = (vclassContainer.getAttribute('data-vclass') || '').toLowerCase();
            // Verificar contra URIs de ontologia y etiquetas en espanol
            if (vclass.includes('person')) return 'person';
            if (vclass.includes('organization') || vclass.includes('group') || vclass.includes('laboratory') ||
                vclass.includes('center') || vclass.includes('department') || vclass.includes('unidad') ||
                vclass.includes('escuela') || vclass.includes('facultad') || vclass.includes('instituto') ||
                vclass.includes('investigaci')) return 'org';
            if (vclass.includes('program') || vclass.includes('degree') || vclass.includes('course') || vclass.includes('programa')) return 'program';
        }

        // --- Nivel 2: Deteccion por selectores de clase/estructura CSS ---
        // Buscar clases CSS conocidas que VIVO usa en sus plantillas shortview
        if (li.querySelector('.shortview_person-img, .shortview_person-data, .hub-sv-person-card, .hub-person-card, .person-img')) return 'person';
        if (li.querySelector('img[src*="organization"], .org-img, .hub-org-card, #organizationIndividual')) return 'org';
        if (li.querySelector('.hub-program-card, #programIndividual, .hub-program-name')) return 'program';

        // --- Nivel 3: Deteccion por contenido textual (ultimo recurso) ---
        // Algunos resultados no tienen clases CSS distintivas pero su texto los delata
        const text = li.textContent || '';
        if (text.includes('Trabajo de Grado') || text.includes('Degree Work')) return 'program';

        // Por defecto, cualquier resultado no clasificado se trata como publicacion
        return 'publication';
    }

    /* ======================================================================
     * SECCION 5: FUNCIONES CONSTRUCTORAS (BUILDERS)
     * Estas funciones toman un elemento <li> crudo de VIVO y construyen
     * el HTML de la tarjeta personalizada del HUB. Cada tipo de resultado
     * tiene su propio builder con estructura y estilos diferentes.
     *
     * Flujo: <li> de VIVO -> extraer datos (nombre, href, img, etc.) ->
     *        sanitizar texto -> aplicar highlighting -> generar HTML
     * ====================================================================== */

    /**
     * sanitizeVIVOText - Corrige caracteres rotos provenientes de VIVO/Solr.
     *
     * VIVO/Solr a veces codifica las vocales acentuadas como "_a", "_e", etc.
     * (ej: "matem_atica" en vez de "matematica"). Esta funcion revierte esa
     * codificacion para mostrar texto legible.
     *
     * @param {string} str - Texto posiblemente corrupto de VIVO
     * @returns {string} Texto con acentos restaurados
     *
     * Por que ocurre? Solr indexa con un esquema que reemplaza diacriticos
     * por underscore + vocal base para normalizar busquedas.
     */
    function sanitizeVIVOText(str) {
        if (!str) return '';
        return str
            .replace(/_a/g, 'á').replace(/_A/g, 'Á')
            .replace(/_e/g, 'é').replace(/_E/g, 'É')
            .replace(/_i/g, 'í').replace(/_I/g, 'Í')
            .replace(/_o/g, 'ó').replace(/_O/g, 'Ó')
            .replace(/_u/g, 'ú').replace(/_U/g, 'Ú')
            .replace(/_n/g, 'ñ').replace(/_N/g, 'Ñ');
    }

    /**
     * normalizeText - Normaliza texto eliminando acentos y diacriticos.
     *
     * Convierte el texto a minusculas y elimina marcas diacriticas usando
     * Unicode NFD (descomposicion canonica). Esto permite comparaciones
     * de texto insensibles a acentos (ej: "García" == "garcia").
     *
     * @param {string} text - Texto a normalizar
     * @returns {string} Texto normalizado sin acentos, en minusculas
     *
     * Uso: Se usa en el filtro de relevancia y en el highlighting para
     * hacer matching robusto entre la query del usuario y el contenido.
     */
    function normalizeText(text) {
        if (!text) return '';
        // NFD descompone "á" en "a" + marca de acento; luego el regex elimina las marcas
        return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    }

    /**
     * extractTitle - Devuelve el titulo propio de un resultado de busqueda.
     *
     * Es el nombre del investigador, el nombre de la organizacion o programa,
     * o el titulo de la publicacion: NO el fragmento de contexto que VIVO
     * agrega debajo.
     *
     * Hace falta porque en las tarjetas ya renderizadas por la plantilla FTL
     * el nombre, el cargo, la facultad y el fragmento cuelgan todos del mismo
     * <a>. Leer `a.textContent` mezclaria las cuatro cosas y un resultado
     * pasaria el filtro por una coincidencia en su fragmento (buscar "rios"
     * devolvia investigadores que solo mencionan rios en sus publicaciones).
     *
     * Los selectores replican los que usan los builders de cada categoria.
     *
     * @param {HTMLElement} li - Elemento <li> de un resultado
     * @returns {string} Titulo del resultado, o cadena vacia si no se encuentra
     */
    function extractTitle(li) {
        // 1. Tarjetas Premium del HUB: el nombre esta aislado en su propio span
        const premium = li.querySelector('.hub-sv-name, .hub-pub-title, .hub-program-name');
        if (premium) return premium.textContent.trim();

        // 2. Estructura estandar de VIVO: el titulo va dentro de un <h3>
        const heading = li.querySelector('h3 a, h3.thumb a');
        if (heading) return heading.textContent.trim();

        // 3. Contenedor data-vclass que envuelve al enlace (FTL por defecto)
        const vclass = li.querySelector('[data-vclass]');
        if (vclass) {
            const inner = vclass.querySelector('.hub-sv-name');
            if (inner) return inner.textContent.trim();
            if (vclass.tagName !== 'A') {
                const a = vclass.querySelector('a[href]');
                if (a) return a.textContent.trim();
            }
        }

        // 4. Respaldo: primer enlace, descontando el fragmento de contexto si lo lleva
        const a = li.querySelector('a[href]');
        if (!a) return '';
        const clon = a.cloneNode(true);
        clon.querySelectorAll('.hub-sv-snippet, .snippet, .hub-sv-role, .hub-sv-dept-tag, .hub-sv-dept')
            .forEach(el => el.remove());
        return clon.textContent.trim();
    }

    /**
     * highlightQuery - Resalta los terminos de busqueda dentro del texto.
     *
     * Busca ocurrencias del query dentro del texto (ignorando acentos y
     * mayusculas/minusculas) y las envuelve en <mark> con clase CSS
     * para resaltado visual. Usa la version normalizada para encontrar
     * posiciones pero preserva el texto original con sus acentos.
     *
     * @param {string} text  - Texto donde buscar y resaltar
     * @param {string} query - Termino de busqueda a resaltar
     * @returns {string} HTML con las coincidencias envueltas en <mark>
     *
     * Ejemplo: highlightQuery("García López", "garcia") ->
     *          "<mark class='hub-hl'>García</mark> López"
     */
    function highlightQuery(text, query) {
        // No resaltar si el texto o query son muy cortos (evitar falsos positivos)
        if (!text || !query || query.length < 2) return text || '';

        // Crear versiones normalizadas (sin acentos, minusculas) para busqueda
        const normText = normalizeText(text);
        const normQuery = normalizeText(query);

        let result = '';
        let lastIdx = 0;
        // Buscar la primera ocurrencia del query normalizado en el texto normalizado
        let idx = normText.indexOf(normQuery);

        // Iterar por todas las ocurrencias encontradas
        while (idx !== -1) {
            // Agregar el texto previo a la coincidencia (sin modificar)
            result += text.slice(lastIdx, idx);
            // Extraer el texto original (con acentos) en la posicion de la coincidencia
            const match = text.slice(idx, idx + query.length);
            // Envolver en <mark> para resaltado visual via CSS
            result += `<mark class="hub-hl">${match}</mark>`;
            lastIdx = idx + query.length;
            // Buscar la siguiente ocurrencia
            idx = normText.indexOf(normQuery, lastIdx);
        }
        // Agregar el texto restante despues de la ultima coincidencia
        result += text.slice(lastIdx);
        return result || text;
    }

    /**
     * getSnippet - Extrae el fragmento de texto descriptivo de un resultado.
     *
     * VIVO genera un "snippet" (extracto) del contenido indexado para cada
     * resultado de busqueda, similar al snippet de Google. Esta funcion lo
     * localiza y lo sanitiza.
     *
     * @param {HTMLLIElement} li - Elemento <li> del resultado de VIVO
     * @returns {string} Texto del snippet sanitizado, o cadena vacia
     */
    function getSnippet(li) {
        const snip = li.querySelector('.snippet, p.snippet');
        return snip ? sanitizeVIVOText(snip.textContent.trim()) : '';
    }

    /**
     * extractYear - Extrae el ano de publicacion de un resultado.
     *
     * Busca un patron de 4 digitos que comience con 19 o 20 (ej: 2023, 1998)
     * en todo el texto del elemento. Se usa para mostrar el ano en tarjetas
     * de publicaciones.
     *
     * @param {HTMLLIElement} li - Elemento <li> del resultado de VIVO
     * @returns {string|null} Ano encontrado (ej: "2023") o null si no hay
     */
    function extractYear(li) {
        const text = li.textContent || '';
        // Regex: buscar un numero de 4 digitos que empiece con 19 o 20
        const m = text.match(/\b(19|20)\d{2}\b/);
        return m ? m[0] : null;
    }

    /* ------------------------------------------------------------------
     * 5.1 BUILDER: TARJETA DE PERSONA (Investigador/Profesor)
     * Construye una tarjeta tipo "card" con:
     * - Avatar circular (foto real o iniciales generadas)
     * - Nombre del investigador (con highlighting)
     * - Rol/cargo academico
     * - Departamento/escuela (como tag)
     * - Snippet descriptivo
     * - Flecha de navegacion
     * ------------------------------------------------------------------ */

    /**
     * buildPersonCard - Construye el HTML de una tarjeta de persona.
     *
     * Extrae datos del <li> de VIVO (nombre, foto, cargo, departamento)
     * y genera una tarjeta card con avatar, informacion y accion.
     * Maneja multiples formatos de HTML de VIVO (Premium FTL y Default FTL).
     *
     * @param {HTMLLIElement} li - Elemento <li> con datos de la persona
     * @returns {string|null} HTML de la tarjeta, o null si no se pudo extraer datos
     *
     * Complejidad: Esta funcion es la mas compleja porque VIVO tiene
     * multiples plantillas FTL (shortview) que generan HTML diferente
     * para personas. Se manejan 3 casos:
     *   1. Tarjeta pre-renderizada (ya tiene clases hub-person-card)
     *   2. HTML con data-vclass (plantilla FTL modificada)
     *   3. HTML nativo de VIVO (fallback con selectores genericos)
     */
    function buildPersonCard(li) {
        // --- Verificar si la tarjeta ya fue pre-renderizada por la plantilla FTL ---
        // Si ya tiene las clases Premium, devolver el HTML tal cual sin reprocesar
        const existingCard = li.querySelector('.hub-person-card, .hub-sv-info, .hub-sv-card-main');
        if (existingCard) return li.innerHTML;

        // Variables para almacenar los datos extraidos de la tarjeta
        let name = '', href = '', imgSrc = '', roleTxt = '', deptTxt = '', snippet = '';

        // --- Estrategia 1: Extraer datos desde contenedor con data-vclass ---
        // Las plantillas FTL modificadas del HUB agregan un contenedor con data-vclass
        const vclassContainer = li.querySelector('[data-vclass]');
        if (vclassContainer) {
            // Caso 1: El contenedor data-vclass ES el tag <a> (Premium FTL)
            // Estructura: <a data-vclass="Person" href="..."><span class="hub-sv-name">...</span></a>
            if (vclassContainer.tagName === 'A') {
                name = (vclassContainer.querySelector('.hub-sv-name') || vclassContainer).textContent.trim();
                href = vclassContainer.getAttribute('href');
                const img = vclassContainer.querySelector('img');
                imgSrc = img ? img.getAttribute('src') : '';
                roleTxt = vclassContainer.querySelector('.hub-sv-role')?.textContent.trim() || '';
                deptTxt = vclassContainer.querySelector('.hub-sv-dept-tag, .hub-sv-dept')?.textContent.trim() || '';
                snippet = vclassContainer.querySelector('.hub-sv-snippet, .snippet')?.textContent.trim() || '';
            } else {
                // Caso 2: El contenedor data-vclass ENVUELVE al tag <a> (Default VIVO FTL)
                // Estructura: <div data-vclass="Person"><a href="...">Nombre</a></div>
                const a = vclassContainer.querySelector('a[href]');
                if (a) {
                    name = a.textContent.trim();
                    href = a.getAttribute('href');
                    const img = vclassContainer.querySelector('img');
                    imgSrc = img ? img.getAttribute('src') : '';
                    const role = vclassContainer.querySelector('.hub-sv-role');
                    roleTxt = role ? role.textContent.trim() : '';
                    const dept = vclassContainer.querySelector('.hub-sv-dept-tag, .hub-sv-dept');
                    deptTxt = dept ? dept.textContent.trim() : '';
                    const snip = vclassContainer.querySelector('.hub-sv-snippet, .snippet');
                    snippet = snip ? snip.textContent.trim() : '';
                }
            }
        }

        // --- Estrategia 2: Fallback robusto si data-vclass no dio resultados ---
        // Buscar con selectores genericos del shortview nativo de VIVO
        if (!href || !name) {
            // Buscar el anchor con el nombre real (NO el que envuelve la imagen)
            const a = li.querySelector('.shortview_person-name a, h1 a, h3 a')
                   || Array.from(li.querySelectorAll('a[href]')).find(el => el.textContent.trim().length > 0 && !el.querySelector('img'));
            if (!a) return null;
            name    = a.textContent.trim();
            href    = a.getAttribute('href');
            // Buscar imagen de perfil con varios selectores posibles
            imgSrc  = li.querySelector('.shortview_person-img img, img.card-img-top, img[width="90"], .hub-sv-photo')?.getAttribute('src') || '';
            // Extraer rol y departamento de spans con clase 'title'
            // VIVO usa <span class="title"> tanto para cargo como para departamento
            const titleSpans = li.querySelectorAll('.person-body span.title, span.title');
            roleTxt = '';
            deptTxt = '';
            titleSpans.forEach(span => {
                const txt = span.textContent.trim();
                const isLink = span.querySelector('a');
                // Si el span contiene un link, es departamento; si no, es cargo
                if (isLink && !deptTxt) {
                    deptTxt = txt.slice(0, 50);
                } else if (!isLink && !roleTxt) {
                    roleTxt = txt.slice(0, 70);
                }
            });
            // Fallbacks adicionales para rol y departamento
            if (!roleTxt) roleTxt = li.querySelector('.hub-sv-role, .card-footer')?.textContent.trim().slice(0, 70) || '';
            if (!deptTxt) deptTxt = li.querySelector('.hub-sv-dept-tag, .hub-sv-dept, .card-text a')?.textContent.trim().slice(0, 50) || '';
            snippet = li.querySelector('.hub-sv-snippet, .snippet')?.textContent.trim() || '';
        }

        // --- Fallback final: si aun no hay datos, devolver HTML crudo ---
        // Prefiere mostrar algo (el HTML original de VIVO) a no mostrar nada
        if (!href || !name) {
            // FALLBACK FINAL: No perder el resultado si ya sabemos que es una persona
            console.warn("[HUB Dashboard] Fallback final activado para investigador:", li.textContent.trim().slice(0, 30));
            return li.innerHTML;
        }

        // --- Limpieza de redundancia en textos ---
        // A veces VIVO repite el cargo o departamento dentro del nombre
        let cleanName = sanitizeVIVOText(name);
        roleTxt = sanitizeVIVOText(roleTxt);
        deptTxt = sanitizeVIVOText(deptTxt);

        // Eliminar cargo/departamento si aparecen repetidos dentro del nombre
        if (roleTxt && cleanName.includes(roleTxt)) cleanName = cleanName.replace(roleTxt, '');
        if (deptTxt && cleanName.includes(deptTxt)) cleanName = cleanName.replace(deptTxt, '');
        // Limpiar caracteres sueltos que puedan quedar (ej: ">" al final)
        cleanName = cleanName.replace(/>\s*$/, '').trim();

        // --- Aplicar highlighting de terminos de busqueda ---
        const hlName = highlightQuery(cleanName, queryText);
        const hlRole = highlightQuery(roleTxt, queryText);
        const hlDept = highlightQuery(deptTxt, queryText);
        const hlSnip = highlightQuery(snippet, queryText);

        // --- Generar avatar con iniciales ---
        // Si no hay foto disponible, se genera un avatar con las iniciales del nombre
        // sobre un fondo de color determinista (siempre el mismo color para el mismo nombre)
        let initials = '?';
        const parts = cleanName.split(', ');
        if (parts.length > 1) {
            // Formato "Apellido, Nombre" -> iniciales = N + A
            initials = (parts[1].charAt(0) + parts[0].charAt(0)).toUpperCase();
        } else {
            // Formato "Nombre Apellido" -> iniciales = N + A (primera y ultima palabra)
            const words = cleanName.split(' ');
            if (words.length > 1) {
                initials = (words[0].charAt(0) + words[words.length-1].charAt(0)).toUpperCase();
            } else if (cleanName) {
                initials = cleanName.charAt(0).toUpperCase();
            }
        }

        // Color determinista basado en hash del nombre
        // Esto garantiza que el mismo nombre siempre tenga el mismo color de avatar
        const hash = cleanName.split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
        const hue = Math.abs(hash) % 360;

        // Determinar si la imagen es un placeholder generico de VIVO
        // Si lo es, usar iniciales directamente en vez de cargar una imagen generica
        const isPlaceholder = !imgSrc || imgSrc.includes('placeholder') || imgSrc.includes('default');

        // Generar HTML del avatar: foto real con fallback a iniciales, o iniciales directas
        const photoHtml = isPlaceholder
            ? `<div class="hub-avatar-initials" style="--avatar-hue: ${hue};">${initials}</div>`
            : `<img class="hub-sv-photo" src="${imgSrc}" alt="${cleanName}" width="68" height="68" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
               <div class="hub-avatar-initials" style="display:none; --avatar-hue: ${hue};">${initials}</div>`;

        // --- Construir y retornar el HTML completo de la tarjeta ---
        return `<a href="${href}" class="hub-person-card">
            <div class="hub-sv-card-main">
                <div class="hub-sv-photo-wrap">
                    ${photoHtml}
                </div>
                <div class="hub-sv-info">
                    <div class="hub-sv-header">
                        <span class="hub-sv-name">${hlName}</span>
                    </div>
                    <span class="hub-sv-role">${hlRole || 'Investigador Universidad del Rosario'}</span>
                    ${deptTxt ? `<span class="hub-sv-dept-tag">${hlDept}</span>` : ''}
                    ${snippet ? `<p class="hub-sv-snippet">${hlSnip}</p>` : ''}
                </div>
                <div class="hub-sv-card-action">
                    <span class="hub-sv-arrow-new">&#8250;</span>
                </div>
            </div>
        </a>`;
    }

    /* ------------------------------------------------------------------
     * 5.2 BUILDER: TARJETA DE ORGANIZACION (Facultad/Grupo/Centro)
     * Construye una tarjeta tipo "card" con:
     * - Icono SVG de edificio (placeholder de logo)
     * - Nombre de la organizacion
     * - Descripcion breve
     * - Flecha de navegacion
     * ------------------------------------------------------------------ */

    /**
     * buildOrgCard - Construye el HTML de una tarjeta de organizacion.
     *
     * Las organizaciones en VIVO incluyen facultades, escuelas, centros de
     * investigacion, grupos de investigacion, departamentos, etc.
     *
     * @param {HTMLLIElement} li - Elemento <li> con datos de la organizacion
     * @returns {string|null} HTML de la tarjeta, o null si no hay datos
     */
    function buildOrgCard(li) {
        // --- Verificar si ya existe una tarjeta pre-renderizada ---
        const existingCard = li.querySelector('.hub-org-card');
        if (existingCard) return li.innerHTML;

        // Buscar el enlace principal con selectores especificos
        // Se evita capturar texto de la descripcion como si fuera el nombre
        const a = li.querySelector('h3 a, h3.thumb a, a.hub-org-card, .org-desc a[href], .individual > a[href], .individual h3 a');
        if (!a) return null;

        // Extraer y sanitizar el nombre de la organizacion
        let name = a.textContent.trim();
        if (!name) name = 'Organización';
        name = sanitizeVIVOText(name);

        const href = a.getAttribute('href');
        if (!href) return null;

        // Extraer descripcion del snippet o titulo auxiliar
        const desc = li.querySelector('span.title, .snippet, .hub-sv-snippet');
        let descTxt = desc ? desc.textContent.trim().slice(0, 160) : '';
        descTxt = sanitizeVIVOText(descTxt);

        // Generar tarjeta con icono SVG de edificio y estructura unificada
        return `<a href="${href}" class="hub-org-card">
            <div class="hub-sv-card-main">
                <div class="hub-sv-photo-wrap">
                    <div class="hub-org-logo-placeholder">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M3 21h18M3 7v14m18-14v14M3 7l9-4 9 4M9 21v-4a2 2 0 0 1 4 0v4M7 8h2m4 0h2m-8 4h2m4 0h2" />
                        </svg>
                    </div>
                </div>
                <div class="hub-org-info">
                    <span class="hub-org-name">${name}</span>
                    <span class="hub-org-desc">${descTxt || 'Organización o Grupo de Investigación de la Universidad del Rosario.'}</span>
                </div>
                <!-- Flecha lateral v16.0 (Sync) -->
                <div class="hub-sv-card-action">
                    <span class="hub-sv-arrow-new">&#8250;</span>
                </div>
            </div>
        </a>`;
    }

    /* ------------------------------------------------------------------
     * 5.3 BUILDER: TARJETA DE PROGRAMA ACADEMICO
     * Construye una tarjeta compacta con:
     * - Icono SVG de birrete (gorro de graduacion)
     * - Nombre del programa (truncado si es muy largo)
     * - Descripcion breve
     * ------------------------------------------------------------------ */

    /**
     * buildProgramCard - Construye el HTML de una tarjeta de programa academico.
     *
     * Los programas en VIVO incluyen pregrados, posgrados, maestrias, doctorados
     * y trabajos de grado. El nombre se trunca para eliminar texto boilerplate
     * que VIVO agrega (ej: "Programa academico de...").
     *
     * @param {HTMLLIElement} li - Elemento <li> con datos del programa
     * @returns {string|null} HTML de la tarjeta, o null si no hay datos
     */
    function buildProgramCard(li) {
        // --- Verificar si ya existe una tarjeta pre-renderizada ---
        const existingCard = li.querySelector('.hub-program-card');
        if (existingCard) return li.innerHTML;

        const a = li.querySelector('h3 a, a.hub-program-card, a[href]');
        if (!a) return null;
        let name = a.textContent.trim() || 'Programa Académico';
        name = sanitizeVIVOText(name);

        const href = a.getAttribute('href');

        // --- Truncamiento inteligente del nombre ---
        // VIVO a veces incluye texto largo como "Ingenieria de Software Programa
        // academico de pregrado..." Cortamos en "Programa acad" para dejar solo el nombre
        const progIdx = name.search(/\s+Programa\s+acad/i);
        if (progIdx > 0) {
            name = name.substring(0, progIdx);
        }
        // Fallback: cortar en "Pulse aqui para..." (texto de VIVO que indica enlace)
        const pulseIdx = name.search(/\.?\s*Pulse\s+aqu/i);
        if (pulseIdx > 0) {
            name = name.substring(0, pulseIdx);
        }
        // Normalizar espacios multiples a uno solo
        name = name.replace(/\s+/g, ' ').trim();

        // Extraer descripcion o detalle adicional del programa
        const mod  = li.querySelector('.hub-program-desc, #programDescription, span.title, .snippet');
        let detail = mod ? mod.textContent.trim() : '';
        detail = sanitizeVIVOText(detail);

        // Aplicar la misma limpieza de truncamiento al detalle
        const detProgIdx = detail.search(/\s*Programa\s+acad/i);
        if (detProgIdx > 0) detail = detail.substring(0, detProgIdx);
        const detPulseIdx = detail.search(/\.?\s*Pulse\s+aqu/i);
        if (detPulseIdx > 0) detail = detail.substring(0, detPulseIdx);
        // Limitar longitud del detalle a 120 caracteres
        detail = detail.slice(0, 120);

        // Generar tarjeta con icono SVG de birrete
        return `<a href="${href}" class="hub-program-card">
            <div class="hub-program-icon-wrap">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
            </div>
            <div class="hub-program-info">
                <span class="hub-program-name">${name}</span>
                ${detail ? `<span class="hub-program-desc">${detail}${detail.length >= 120 ? '…' : ''}</span>` : ''}
            </div>
        </a>`;
    }

    /* ------------------------------------------------------------------
     * 5.4 BUILDER: FILA DE PUBLICACION
     * Construye una fila tipo "row" con:
     * - Icono SVG de libro
     * - Tipo de publicacion (articulo, libro, etc.)
     * - Titulo con enlace
     * - Snippet descriptivo
     * ------------------------------------------------------------------ */

    /**
     * buildPublicationRow - Construye el HTML de una fila de publicacion.
     *
     * Las publicaciones incluyen articulos, libros, capitulos de libro,
     * ponencias, tesis, etc. Se muestran en formato de lista (filas)
     * en vez de grid porque suelen ser mas textuales.
     *
     * @param {HTMLLIElement} li - Elemento <li> con datos de la publicacion
     * @returns {string|null} HTML de la fila, o null si no hay datos
     */
    function buildPublicationRow(li) {
        const a = li.querySelector('h3 a, a[href]');
        if (!a) return null;

        // Extraer y sanitizar titulo de la publicacion
        let title = a.textContent.trim();
        title = sanitizeVIVOText(title);
        const href = a.getAttribute('href');

        // Detectar tipo y extraer metadata
        const type = detectType(li);
        const year = extractYear(li) || 'Sin fecha';
        const snippet = getSnippet(li);

        // Extraer tipo de publicacion de nodos de texto plano
        // VIVO pone el tipo como texto suelto separado por "|" (ej: "| Artículo |")
        let typeText = '';
        li.childNodes.forEach(n => {
            if (n.nodeType === 3) {
                const t = n.textContent.replace(/\|/g, '').trim();
                if (t && t.length > 2 && t.length < 60) typeText = t;
            }
        });

        // Generar fila de publicacion con icono de libro
        return `<div class="hub-pub-row hub-pub-card">
            <div class="hub-pub-icon-wrap">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                </svg>
            </div>
            <div class="hub-pub-content">
                ${typeText ? `<span class="hub-pub-type">${typeText}</span>` : ''}
                <a href="${href}" class="hub-pub-title">${title}</a>
                ${snippet ? `<p class="hub-pub-snippet">${snippet.slice(0,180)}${snippet.length > 180 ? '…' : ''}</p>` : ''}
            </div>
        </div>`;
    }

    /* ------------------------------------------------------------------
     * 5.5 BUILDER: FILA DE PROYECTO DE INVESTIGACION
     * Similar a publicacion pero sin icono ni tipo. Se usa para proyectos
     * de investigacion que no tienen categoria mas especifica.
     * ------------------------------------------------------------------ */

    /**
     * buildProjectRow - Construye el HTML de una fila de proyecto.
     *
     * @param {HTMLLIElement} li - Elemento <li> con datos del proyecto
     * @returns {string|null} HTML de la fila, o null si no hay datos
     */
    function buildProjectRow(li) {
        const a = li.querySelector('a[href]');
        if (!a) return null;
        const name = a.textContent.trim();
        const href = a.getAttribute('href');
        const snippet = getSnippet(li);

        return `<div class="hub-pub-row">
            <a href="${href}" class="hub-pub-title">${name}</a>
            ${snippet ? `<p class="hub-pub-snippet">${snippet.slice(0,180)}${snippet.length > 180 ? '…' : ''}</p>` : ''}
        </div>`;
    }

    /* ------------------------------------------------------------------
     * 5.6 BUILDER: FILA DE EVENTO ACADEMICO
     * Similar a proyecto. Se usa para conferencias, seminarios, etc.
     * ------------------------------------------------------------------ */

    /**
     * buildEventRow - Construye el HTML de una fila de evento.
     *
     * @param {HTMLLIElement} li - Elemento <li> con datos del evento
     * @returns {string|null} HTML de la fila, o null si no hay datos
     */
    function buildEventRow(li) {
        const a = li.querySelector('a[href]');
        if (!a) return null;
        const name = a.textContent.trim();
        const href = a.getAttribute('href');
        const snippet = getSnippet(li);

        return `<div class="hub-pub-row">
            <a href="${href}" class="hub-pub-title">${name}</a>
            ${snippet ? `<p class="hub-pub-snippet">${snippet.slice(0,180)}${snippet.length > 180 ? '\\u2026' : ''}</p>` : ''}
        </div>`;
    }

    /* ======================================================================
     * SECCION 6: DEDUPLICACION GLOBAL
     * Set global que almacena las URLs de resultados ya procesados.
     * Cuando un resultado aparece en multiples categorias (ej: una persona
     * que tambien aparece en organizaciones), se muestra solo en la primera
     * categoria donde fue encontrado. Esto evita confusion del usuario.
     *
     * Por que un Set? Busqueda O(1) por URL, sin duplicados posibles.
     * ====================================================================== */
    const seenUrls = new Set();

    /* ======================================================================
     * SECCION 7: CONFIGURACION DE CATEGORIAS
     * Objeto central que define las 4 categorias de busqueda del dashboard.
     * Cada categoria especifica:
     *   - url: endpoint de VIVO con el classgroup correspondiente
     *   - prefix: prefijo para IDs de elementos DOM
     *   - sectionId/contentId: IDs de los contenedores HTML
     *   - skeletonType: tipo de skeleton a mostrar ('grid' o 'list')
     *   - limit: cantidad inicial de resultados a mostrar
     *   - typeFilter: funcion para filtrar resultados por tipo
     *   - builder: funcion constructora de tarjetas
     *
     * Los classgroups de VIVO agrupan las ontologias:
     *   - people: personas (investigadores, profesores, estudiantes)
     *   - organizations: organizaciones Y programas (comparten classgroup)
     *   - publications: publicaciones academicas
     *
     * Nota: organizaciones y programas comparten el mismo classgroup en VIVO
     * (organizations), por lo que se diferencian con typeFilter:
     *   - organizations: solo los que detectType() clasifica como 'org'
     *   - programs: todo lo que NO es 'org' dentro de organizations
     * ====================================================================== */
    const CATEGORIES = {
        profiles: {
            url:         `${SEARCH}?${baseQ}&filters_category=category:http://vivoweb.org/ontology%23vitroClassGrouppeople`,
            prefix:      'profiles',
            sectionId:   'category-profiles',
            contentId:   'grid-profiles-content',
            skeletonType:'grid',
            limit:       4,  // v16.2 Sync: 2x2 grid para vista compacta
            // NO filtrar por tipo: los resultados del classgroup "people" ya estan validados
            typeFilter:  li => true,
            typeParam:   'Person',
            builder:     buildPersonCard
        },
        organizations: {
            url:         `${SEARCH}?${baseQ}&filters_category=category:http://vivoweb.org/ontology%23vitroClassGrouporganizations`,
            prefix:      'organizations',
            sectionId:   'category-organizations',
            contentId:   'grid-organizations-content',
            skeletonType:'grid',
            limit:       4,  // v16.2 Sync: 2x2 grid para vista compacta
            // Solo mostrar los que se detectan como organizacion
            typeFilter:  li => detectType(li) === 'org',
            typeParam:   'Organization',
            builder:     buildOrgCard
        },
        programs: {
            url:         `${SEARCH}?${baseQ}&filters_category=category:http://vivoweb.org/ontology%23vitroClassGrouporganizations`,
            prefix:      'programs',
            sectionId:   'category-programs',
            contentId:   'list-programs-content',
            skeletonType:'list',
            limit:       6,
            // LOGICA INVERSA: todo lo que NO es 'org' dentro del classgroup organizations = programa
            // Esto funciona porque VIVO agrupa programas y organizaciones en el mismo classgroup
            typeFilter:  li => detectType(li) !== 'org',
            typeParam:   'Program',
            builder:     buildProgramCard
        },
        publications: {
            url:         `${SEARCH}?${baseQ}&filters_category=category:http://vivoweb.org/ontology%23vitroClassGrouppublications`,
            prefix:      'publications',
            sectionId:   'category-publications',
            contentId:   'list-publications-content',
            skeletonType:'list',
            limit:       6,
            // NO filtrar por tipo: los resultados del classgroup "publications" ya estan validados
            typeFilter:  li => true,
            builder:     buildPublicationRow
        },
    };

    /* ======================================================================
     * SECCION 8: CARGADOR DE CATEGORIAS (FUNCION PRINCIPAL)
     * Esta es la funcion central del dashboard. Para cada categoria:
     *   1. Muestra skeleton loaders
     *   2. Verifica cache en sessionStorage
     *   3. Si no hay cache, hace fetch AJAX al endpoint de VIVO
     *   4. Parsea el HTML de respuesta con DOMParser
     *   5. Filtra, deduplica y valida los resultados
     *   6. Construye las tarjetas con el builder correspondiente
     *   7. Renderiza en el DOM con animacion escalonada
     *   8. Actualiza badges del sidebar con animacion count-up
     *   9. Genera footer con boton "Ver todos" si hay mas resultados
     * ====================================================================== */

    /**
     * loadCategory - Carga y renderiza los resultados de una categoria.
     *
     * Funcion asincrona que orquesta todo el proceso de carga de una
     * categoria: desde el fetch AJAX hasta el renderizado final. Se
     * ejecuta en el contexto de window.HUB_DASHBOARD (this = dashboard).
     *
     * @param {string} key - Clave de la categoria ('profiles', 'organizations',
     *                       'programs', 'publications')
     * @returns {Promise<void>}
     *
     * Manejo de errores: Si el fetch falla, se oculta la seccion y se
     * muestra "!" en el badge. Los errores no detienen la carga de otras
     * categorias gracias al manejo individual de try/catch.
     */
    async function loadCategory(key) {
        // Obtener la configuracion de la categoria
        const cfg    = CATEGORIES[key];

        // Obtener referencias a elementos DOM del sidebar y header
        const badge  = document.getElementById(`hub-sidebar-${cfg.prefix}-v156`);
        const total  = document.getElementById(`hub-header-${cfg.prefix}-v156`);
        const section= document.getElementById(cfg.sectionId);
        const container= document.getElementById(cfg.contentId);
        const btn    = document.getElementById(`btn-view-${cfg.prefix}`); // Boton deprecado

        // Mostrar skeleton loaders mientras se cargan los datos
        // Para grid se muestra el mismo numero que el limite; para list, 4 filas
        showSkeleton(cfg.sectionId, cfg.skeletonType === 'grid' ? cfg.limit : 4, cfg.skeletonType);

        try {
            // --- CACHE: Verificar sessionStorage antes de hacer fetch ---
            // La clave de cache se genera con btoa (base64) de la URL completa
            // para garantizar unicidad por consulta
            const cacheKey = 'hub_v13_' + btoa(unescape(encodeURIComponent(cfg.url)));
            let html = sessionStorage.getItem(cacheKey);

            if (!html) {
                // No hay cache: hacer fetch AJAX al endpoint de busqueda de VIVO
                const res  = await fetch(cfg.url);
                html = await res.text();
                // Guardar en cache para evitar re-fetch en la misma sesion
                // Se envuelve en try/catch porque sessionStorage tiene limite de cuota (~5MB)
                try { sessionStorage.setItem(cacheKey, html); } catch(e) {} // Ignorar limite cuota
            }

            // --- PARSEO DEL HTML DE RESPUESTA ---
            // DOMParser convierte el string HTML en un documento DOM navegable
            // Esto permite usar querySelector/querySelectorAll sobre la respuesta
            const vDoc = new DOMParser().parseFromString(html, 'text/html');

            // --- EXTRAER CONTEO TOTAL ---
            // VIVO muestra el total en un <h2> con clase "searchResultsHeader"
            // Solo nos interesa el numero, no el texto decorativo
            const h2 = vDoc.querySelector('h2.searchResultsHeader');
            let totalCount = 0;
            if (h2) {
                // Extraer solo los nodos de texto (ignorar elementos hijos)
                let txt = '';
                h2.childNodes.forEach(n => { if (n.nodeType === 3) txt += n.textContent; });
                // Buscar el primer numero en el texto (ej: "42 resultados")
                const m = txt.match(/(\d+)/);
                totalCount = m ? parseInt(m[1], 10) : 0;
            }

            // Limpiar los skeleton loaders ahora que tenemos datos
            clearSkeleton(cfg.sectionId);

            // --- FILTRADO Y PROCESAMIENTO DE RESULTADOS ---
            // Verificar si la seccion esta expandida (el usuario hizo clic en "Ver todos")
            const isExpanded = window.HUB_DASHBOARD.state[key] && window.HUB_DASHBOARD.state[key].expanded;

            // Usar datos filtrados si hay un filtro activo (ej: filtro por facultad)
            // Si no, usar los datos originales sin filtrar
            let relevant = this.state[key].filteredData || this.state[key].data;

            if (!this.state[key].data) {
                // Primera carga: extraer resultados del HTML parseado
                const searchList = vDoc.querySelector('ul.searchhits');
                if (!searchList) {
                    // No hay lista de resultados: ocultar la seccion
                    if (section) section.style.display = 'none';
                    if (badge) {
                        badge.classList.remove('loading');
                        // Ocultar el item del sidebar si no hay resultados
                        const sidebarLi = badge.closest('li');
                        if (sidebarLi) sidebarLi.style.display = 'none';
                        badge.textContent = '';
                    }
                    return;
                }

                // Obtener todos los <li> hijos directos de la lista de resultados
                const items = Array.from(searchList.querySelectorAll(':scope > li'));

                relevant = items
                    // Filtro 1: Aplicar filtro de tipo segun configuracion de la categoria
                    // (ej: solo personas para profiles, solo orgs para organizations)
                    .filter(li => cfg.typeFilter(li))
                    // Filtro 2: Deduplicacion global por URL
                    // Si la URL del resultado ya fue vista en otra categoria, descartarlo
                    .filter(li => {
                        const a = li.querySelector('a[href]');
                        if (!a) return false;
                        const href = a.getAttribute('href');
                        if (seenUrls.has(href)) return false;
                        seenUrls.add(href);
                        return true;
                    })
                    // Filtro 3: Validacion de relevancia por TITULO
                    // El termino buscado debe aparecer en el titulo propio del
                    // resultado (nombre del investigador, nombre de la organizacion
                    // o programa, titulo de la publicacion), no en el fragmento de
                    // contexto que VIVO agrega debajo. Sin esto, buscar "rios"
                    // mostraba investigadores que solo mencionan rios en sus
                    // publicaciones, aunque no se apelliden Rios.
                    // Usa normalizacion para ignorar acentos ("García" matchea "garcia")
                    // y compara token por token para aceptar ordenes distintos
                    // (ej: "maria rios" matchea "Rios Perez, Maria").
                    .filter(li => {
                        if (!queryText || queryText.length < 3) return true;
                        const titleNorm = normalizeText(extractTitle(li));
                        if (!titleNorm) return false;
                        // Todos los tokens del query (2+ letras) deben estar en el titulo
                        return normalizeText(queryText)
                            .split(/\s+/)
                            .filter(tok => tok.length >= 2)
                            .every(tok => titleNorm.includes(tok));
                    });

                // Almacenar los datos procesados en el estado global para no reprocesar
                this.state[key].data = relevant;
            }

            // --- PAGINACION: Mostrar solo los primeros N resultados (o todos si expandido) ---
            const limit = cfg.limit || 6;
            const shownItems = isExpanded ? relevant : relevant.slice(0, limit);

            // Si no hay resultados despues de filtrar, ocultar la seccion completa
            if (shownItems.length === 0) {
                if (section) section.style.display = 'none';
                if (badge) {
                    badge.classList.remove('loading');
                    const sidebarLi = badge.closest('li');
                    if (sidebarLi) sidebarLi.style.display = 'none';
                    badge.textContent = '';
                }
                return;
            }

            // --- RENDERIZADO DE TARJETAS ---
            // Construir HTML de cada tarjeta usando el builder de la categoria
            // Filtrar nulls (builders que no pudieron extraer datos)
            container.innerHTML = shownItems
                .map(li => cfg.builder(li))
                .filter(html => html !== null)
                .join('');

            // --- ANIMACION ESCALONADA (STAGGER) ---
            // Cada tarjeta aparece con un delay incremental de 60ms
            // Esto crea un efecto de "cascada" donde las tarjetas aparecen una tras otra
            const cards = container.children;
            for (let i = 0; i < cards.length; i++) {
                cards[i].style.animationDelay = `${i * 0.06}s`;
            }

            // --- ACTUALIZACION DE BADGES DEL SIDEBAR ---
            // Se usa setTimeout de 500ms para ganar la "carrera" contra los scripts
            // nativos de VIVO que tambien intentan actualizar los conteos
            const finalCount = relevant.length;

            setTimeout(() => {
                if (badge) {
                    // Quitar clase de loading del badge
                    badge.classList.remove('loading');
                    // Mostrar u ocultar el item del sidebar segun haya resultados
                    const sidebarLi = badge.closest('li');
                    if (sidebarLi) sidebarLi.style.display = (finalCount > 0 ? 'flex' : 'none');
                    // Animar el conteo de 0 al total
                    animateCount(badge, finalCount);
                }

                // Actualizar conteo en el header de la seccion
                if (total) {
                    total.textContent = finalCount.toLocaleString('es-CO');
                    total.style.display = (finalCount > 0 ? 'inline-block' : 'none');
                }
            }, 500);

            // --- RESTRICCION DE ALTURA PARA SECCION EXPANDIDA ---
            // Cuando el usuario expande una seccion, se limita la altura maxima
            // y se agrega scroll vertical para evitar paginas excesivamente largas
            if (isExpanded && relevant.length > limit) {
                container.style.maxHeight = '720px';
                container.style.overflowY = 'auto';
                container.style.overflowX = 'hidden';
                container.style.paddingRight = '12px';
                container.classList.add('expanded-scrollable');
            } else {
                // Estado colapsado: quitar restricciones de altura
                container.style.maxHeight = '';
                container.style.overflowY = '';
                container.style.overflowX = '';
                container.style.paddingRight = '';
                container.classList.remove('expanded-scrollable');
            }

            // --- FOOTER CON CONTADOR Y BOTON EXPANDIR/COLAPSAR ---
            // Muestra "Mostrando X de Y" y un boton para ver todos los resultados
            const counterHtml = `<span class="hub-category-counter">Mostrando <strong>${shownItems.length}</strong> de <strong>${relevant.length}</strong></span>`;

            // Renderizar el footer de la seccion segun el estado actual
            const footer = section.querySelector('.category-footer');
            if (footer) {
                if (relevant.length > limit) {
                    // Hay mas resultados de los que se muestran: mostrar boton
                    footer.innerHTML = `
                        <div class="hub-footer-actions">
                            ${counterHtml}
                            <button class="view-all-btn" onclick="HUB_DASHBOARD.toggleExpand('${key}')">
                                ${isExpanded ? `CONTRAER RESULTADOS` : `VER LOS ${relevant.length} RESULTADOS`}
                            </button>
                        </div>`;
                    footer.style.display = 'block';
                } else {
                    // Todos los resultados ya se muestran: solo mostrar contador
                    footer.innerHTML = `<div class="hub-footer-actions" style="justify-content:flex-start;">${counterHtml}</div>`;
                    footer.style.display = 'block';
                }
            }

            // Asegurar que la seccion sea visible
            section.style.display = 'block';

            // Actualizar el total en el header de seccion.
            // Se usa el conteo YA FILTRADO por titulo (relevant.length), no el
            // total crudo de VIVO (totalCount): tras el filtro de relevancia el
            // numero de VIVO incluiria resultados que no se muestran y el header
            // contradiria a las tarjetas visibles.
            if (total) total.textContent = relevant.length.toLocaleString('es-CO');

            // Ocultar boton antiguo "Ver todos" (reemplazado por expand/collapse)
            if (btn) btn.style.display = 'none';


        } catch (e) {
            // --- MANEJO DE ERRORES ---
            // Si falla el fetch o el parseo, no bloquear las demas categorias
            console.warn(`[HUB Dashboard v4] Error cargando "${key}":`, e);
            clearSkeleton(cfg.sectionId);
            // Ocultar la seccion con error
            if (section) section.style.display = 'none';
            // Mostrar "!" en el badge como indicador de error
            if (badge) { badge.textContent = '!'; badge.classList.remove('loading'); }
        }
    }

    /* ======================================================================
     * SECCION 9: TOOLBAR - ORDENAMIENTO Y FILTROS
     * Barra de herramientas que permite al usuario:
     *   - Ordenar resultados por relevancia, A-Z o Z-A
     *   - Filtrar por facultad/departamento
     *
     * La toolbar se construye dinamicamente con JavaScript porque no existe
     * en el HTML base de VIVO (se inyecta sobre la pagina de resultados).
     * ====================================================================== */

    /**
     * buildToolbar - Construye e inserta la barra de herramientas.
     *
     * Crea un toolbar con:
     *   - Selector de ordenamiento (relevancia, A-Z, Z-A)
     *   - Dropdown de filtro por facultad (se llena despues de cargar profiles)
     *   - Contenedor para chips de filtros activos
     *
     * @returns {void}
     *
     * Accesibilidad: Usa atributos ARIA (role="toolbar", aria-label,
     * aria-haspopup, aria-expanded) para lectores de pantalla.
     */
    function buildToolbar() {
        const mainResults = document.getElementById('dashboard-main-results');
        // No crear toolbar si ya existe o si no hay contenedor principal
        if (!mainResults || document.getElementById('hub-toolbar')) return;

        // Crear el elemento toolbar con atributos de accesibilidad
        const toolbar = document.createElement('div');
        toolbar.id = 'hub-toolbar';
        toolbar.setAttribute('role', 'toolbar');
        toolbar.setAttribute('aria-label', 'Filtros y ordenamiento de resultados');

        // HTML interno del toolbar: grupo de ordenamiento + grupo de filtro por facultad
        toolbar.innerHTML = `
            <div class="hub-toolbar-group">
                <label for="hub-sort-select" class="hub-toolbar-label">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:4px;">
                        <path d="M3 6h18M6 12h12M9 18h6"/>
                    </svg>
                    Ordenar por
                </label>
                <select id="hub-sort-select" class="hub-toolbar-select" aria-label="Ordenar resultados">
                    <option value="relevance">Relevancia</option>
                    <option value="az">Alfabético (A-Z)</option>
                    <option value="za">Alfabético (Z-A)</option>
                </select>
            </div>

            <div class="hub-toolbar-group">
                <div class="hub-toolbar-filter-wrap">
                    <button id="hub-filter-faculty-btn" class="hub-toolbar-dropdown" aria-haspopup="true" aria-expanded="false">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:2px"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                        Facultad
                        <svg class="hub-toolbar-chevron" width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </button>
                    <div class="hub-toolbar-dropdown-panel" id="hub-filter-faculty-panel" role="listbox" aria-label="Filtrar por facultad">
                        <p class="hub-toolbar-panel-empty">Cargando...</p>
                    </div>
                </div>
            </div>`;

        // Insertar el toolbar al inicio del contenedor de resultados
        mainResults.insertBefore(toolbar, mainResults.firstChild);

        // Crear contenedor para chips de filtros activos (ej: "Facultad: Medicina x")
        const activeFiltersContainer = document.createElement('div');
        activeFiltersContainer.id = 'hub-active-filters';
        activeFiltersContainer.className = 'hub-active-filters-wrap';
        mainResults.insertBefore(activeFiltersContainer, toolbar.nextSibling);

        // --- Manejador de ordenamiento ---
        // Cuando el usuario cambia el select, se reordenan los datos en memoria
        // y se vuelven a renderizar las tarjetas
        const sortSelect = document.getElementById('hub-sort-select');
        if (sortSelect) {
            sortSelect.addEventListener('change', function() {
                const sortMode = this.value;
                const dash = window.HUB_DASHBOARD;
                if (!dash) return;

                // Reordenar datos de todas las categorias segun el modo seleccionado
                Object.keys(dash.state).forEach(key => {
                    const data = dash.state[key].data;
                    if (!data || data.length === 0) return;

                    if (sortMode === 'az') {
                        // Ordenamiento alfabetico ascendente (A-Z) con locale espanol
                        data.sort((a, b) => {
                            const nameA = (a.querySelector('a[href]')?.textContent || '').trim().toLowerCase();
                            const nameB = (b.querySelector('a[href]')?.textContent || '').trim().toLowerCase();
                            return nameA.localeCompare(nameB, 'es');
                        });
                    } else if (sortMode === 'za') {
                        // Ordenamiento alfabetico descendente (Z-A) con locale espanol
                        data.sort((a, b) => {
                            const nameA = (a.querySelector('a[href]')?.textContent || '').trim().toLowerCase();
                            const nameB = (b.querySelector('a[href]')?.textContent || '').trim().toLowerCase();
                            return nameB.localeCompare(nameA, 'es');
                        });
                    }
                    // Re-renderizar la categoria con el nuevo orden
                    // (si sortMode es 'relevance', el orden original se mantiene)
                    dash.loadCategory(key);
                });
            });
        }

        // --- Manejador del dropdown de facultad ---
        // Toggle del panel desplegable al hacer clic en el boton
        const facultyBtn = document.getElementById('hub-filter-faculty-btn');
        const facultyPanel = document.getElementById('hub-filter-faculty-panel');
        if (facultyBtn && facultyPanel) {
            facultyBtn.addEventListener('click', function(e) {
                e.stopPropagation(); // Evitar que el clic cierre inmediatamente el panel
                const isOpen = facultyPanel.classList.toggle('open');
                facultyBtn.setAttribute('aria-expanded', isOpen);
            });
            // Cerrar el panel al hacer clic fuera de el
            document.addEventListener('click', function() {
                facultyPanel.classList.remove('open');
                facultyBtn.setAttribute('aria-expanded', 'false');
            });
            // Evitar que clics dentro del panel lo cierren
            facultyPanel.addEventListener('click', function(e) { e.stopPropagation(); });
        }
    }

    /**
     * populateFacultyFilter - Llena el dropdown de facultades con datos reales.
     *
     * Se ejecuta DESPUES de que la categoria "profiles" termina de cargar,
     * porque necesita los datos de departamento/escuela de los investigadores
     * para construir la lista de facultades disponibles.
     *
     * Flujo: profiles cargados -> extraer departamentos unicos -> generar
     *        opciones del dropdown -> agregar listeners de filtrado
     *
     * @returns {void}
     *
     * Caracteristicas:
     *   - Buscador interno si hay mas de 5 facultades (para facilitar la seleccion)
     *   - Opcion "Todas" para limpiar el filtro
     *   - Chips visuales para indicar filtro activo
     */
    function populateFacultyFilter() {
        const panel = document.getElementById('hub-filter-faculty-panel');
        if (!panel) return;
        const dash = window.HUB_DASHBOARD;
        if (!dash || !dash.state.profiles || !dash.state.profiles.data) return;

        // Extraer facultades/departamentos unicos de los datos de perfiles
        const faculties = new Set();
        dash.state.profiles.data.forEach(li => {
            const dept = li.querySelector('.hub-sv-dept-tag, .hub-sv-dept');
            if (dept) {
                const txt = dept.textContent.trim();
                if (txt) faculties.add(txt);
            }
        });

        // Si no hay datos de facultad, mostrar mensaje informativo
        if (faculties.size === 0) {
            panel.innerHTML = '<p class="hub-toolbar-panel-empty">Sin datos de facultad disponibles</p>';
            return;
        }

        // Construir HTML del panel de opciones
        let html = '';

        // Si hay muchas facultades, agregar un buscador interno para filtrar
        if (faculties.size > 5) {
            html += `
            <div class="hub-dropdown-search">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                <input type="text" id="hub-faculty-search-input" placeholder="Buscar facultad..." autocomplete="off">
            </div>`;
        }

        // Generar lista de opciones: "Todas" (activa por defecto) + cada facultad
        html += '<div class="hub-dropdown-options-list">';
        html += '<button class="hub-toolbar-filter-option hub-filter-active" data-faculty="all">Todas</button>';
        faculties.forEach(f => {
            html += `<button class="hub-toolbar-filter-option" data-faculty="${f}">${f}</button>`;
        });
        html += '</div>';
        panel.innerHTML = html;

        // --- Listener para el buscador interno del dropdown ---
        // Filtra las opciones en tiempo real mientras el usuario escribe
        const searchInput = document.getElementById('hub-faculty-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', function(e) {
                const term = e.target.value.toLowerCase();
                panel.querySelectorAll('.hub-toolbar-filter-option').forEach(btn => {
                    // No ocultar la opcion "Todas"
                    if (btn.getAttribute('data-faculty') === 'all') return;
                    const text = btn.textContent.toLowerCase();
                    btn.style.display = text.includes(term) ? 'flex' : 'none';
                });
            });
            // Evitar que hacer clic en el input cierre el dropdown
            searchInput.addEventListener('click', e => e.stopPropagation());
        }

        // --- Listeners para cada opcion de facultad ---
        // Al seleccionar una facultad, se filtran TODAS las categorias por ese criterio
        panel.querySelectorAll('.hub-toolbar-filter-option').forEach(btn => {
            btn.addEventListener('click', function() {
                // Actualizar estilo activo: quitar de todos, agregar al seleccionado
                panel.querySelectorAll('.hub-toolbar-filter-option').forEach(b => b.classList.remove('hub-filter-active'));
                this.classList.add('hub-filter-active');

                const faculty = this.getAttribute('data-faculty');
                const dash = window.HUB_DASHBOARD;
                if (!dash) return;

                if (faculty === 'all') {
                    // "Todas" seleccionado: limpiar filtros de todas las categorias
                    Object.keys(dash.state).forEach(k => dash.state[k].filteredData = null);
                    // Limpiar chips de filtros activos
                    document.getElementById('hub-active-filters').innerHTML = '';
                } else {
                    // Facultad especifica seleccionada: filtrar datos de cada categoria
                    // Se busca el nombre de la facultad en TODO el texto del <li>
                    // para capturar coincidencias tanto en personas como en publicaciones
                    Object.keys(dash.state).forEach(k => {
                        const data = dash.state[k].data;
                        if (!data) return;
                        dash.state[k].filteredData = data.filter(li => {
                            const textContent = li.textContent.trim().toLowerCase();
                            return textContent.includes(faculty.toLowerCase());
                        });
                    });

                    // Mostrar chip visual con el filtro activo y boton para eliminarlo
                    document.getElementById('hub-active-filters').innerHTML = `
                        <div class="hub-filter-chip">
                            <span>Facultad: <strong>${faculty}</strong></span>
                            <button onclick="document.querySelector('[data-faculty=\\'all\\']').click()" aria-label="Eliminar filtro de facultad">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                            </button>
                        </div>
                    `;
                }

                // Re-renderizar todas las categorias con los datos filtrados
                Object.keys(dash.state).forEach(k => dash.loadCategory(k));

                // Cerrar el panel dropdown despues de seleccionar
                panel.classList.remove('open');
                document.getElementById('hub-filter-faculty-btn')?.setAttribute('aria-expanded', 'false');
            });
        });
    }

    /* ======================================================================
     * SECCION 10: SIDEBAR - NAVEGACION Y SCROLLSPY
     * El sidebar izquierdo muestra las categorias disponibles con badges
     * de conteo. Permite navegacion rapida entre secciones y tiene
     * scrollspy (resalta automaticamente la seccion visible).
     * ====================================================================== */

    // --- Navegacion por clic en items del sidebar ---
    // Al hacer clic en un item del sidebar, se hace scroll suave a la seccion
    document.querySelectorAll('#content-type-menu li[data-target]').forEach(li => {
        li.addEventListener('click', () => {
            const targetId = li.getAttribute('data-target');
            const target   = document.getElementById(targetId);
            if (target && target.style.display !== 'none') {
                // Scroll suave con offset negativo para compensar la toolbar fija
                // (-80px para que el titulo de seccion no quede debajo del toolbar)
                const yOffset = -80;
                const y = target.getBoundingClientRect().top + window.pageYOffset + yOffset;
                window.scrollTo({ top: y, behavior: 'smooth' });
            }
            // Actualizar estado activo: quitar de todos, agregar al clickeado
            document.querySelectorAll('#content-type-menu li').forEach(l => l.classList.remove('active-filter'));
            li.classList.add('active-filter');
        });
    });

    // --- Scrollspy con IntersectionObserver ---
    // Detecta automaticamente cual seccion es visible y resalta el item
    // correspondiente del sidebar. Usa IntersectionObserver (API nativa)
    // en vez de scroll listener para mejor rendimiento.
    const sectionIds = Object.values(CATEGORIES).map(c => c.sectionId);

    // Flag para desactivar scrollspy durante animaciones de expand/collapse
    // Evita que el scrollspy "salte" mientras se redimensiona una seccion
    let isExpanding = false;

    const observer = new IntersectionObserver(entries => {
        // No actualizar sidebar si estamos en medio de una animacion de expansion
        if (isExpanding) return;
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const sId = entry.target.id;
                // Resaltar el item del sidebar cuyo data-target coincide con la seccion visible
                document.querySelectorAll('#content-type-menu li').forEach(l => {
                    const matches = l.getAttribute('data-target') === sId;
                    l.classList.toggle('active-filter', matches);
                });
            }
        });
    }, { threshold: 0.4 }); // 40% de la seccion debe ser visible para activarse

    // Registrar cada seccion de categoria para observacion
    sectionIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) observer.observe(el);
    });

    /* ======================================================================
     * SECCION 11: OBJETO GLOBAL HUB_DASHBOARD
     * Objeto principal que expone la API publica del dashboard.
     * Se monta en window para ser accesible desde el HTML (onclick en botones)
     * y desde otros scripts.
     *
     * Contiene:
     *   - state: estado de cada categoria (datos, expansion, filtros)
     *   - categories: configuracion de categorias
     *   - loadCategory: funcion de carga (reutilizable para re-renders)
     *   - toggleExpand: expandir/colapsar una categoria
     *   - init: funcion de inicializacion que arranca todo el proceso
     * ====================================================================== */
    window.HUB_DASHBOARD = {
        // Estado global: almacena datos, estado de expansion y filtros por categoria
        state: {},
        // Referencia a la configuracion de categorias
        categories: CATEGORIES,
        // Referencia a la funcion de carga
        loadCategory: loadCategory,

        /**
         * toggleExpand - Alterna el estado expandido/colapsado de una categoria.
         *
         * Cuando el usuario hace clic en "VER TODOS LOS RESULTADOS", esta funcion
         * cambia el flag expanded y re-renderiza la categoria. Incluye scroll
         * suave a la seccion expandida y desactiva temporalmente el scrollspy
         * para evitar saltos visuales.
         *
         * @param {string} key - Clave de la categoria a expandir/colapsar
         * @returns {void}
         */
        toggleExpand: function(key) {
            // Inicializar estado si no existe
            this.state[key] = this.state[key] || {};
            // Alternar flag de expansion
            this.state[key].expanded = !this.state[key].expanded;
            // Desactivar scrollspy durante la animacion
            isExpanding = true;
            // Re-renderizar la categoria con el nuevo estado
            this.loadCategory(key);
            if (this.state[key].expanded) {
                // Si se expandio: hacer scroll suave a la seccion
                setTimeout(() => {
                    document.querySelector(`#category-${key}`).scrollIntoView({ behavior: 'smooth', block: 'start' });
                    // Reactivar scrollspy despues de que termine la animacion de scroll
                    setTimeout(() => { isExpanding = false; }, 800);
                }, 100);
            } else {
                // Si se colapso: reactivar scrollspy inmediatamente
                isExpanding = false;
            }
        },

        /**
         * init - Funcion de inicializacion del dashboard.
         *
         * Orquesta todo el proceso de arranque:
         *   1. Inicializa el estado de cada categoria
         *   2. Construye la toolbar
         *   3. Crea el boton "Volver arriba"
         *   4. Carga las 4 categorias en serie (no en paralelo)
         *   5. Llena el filtro de facultad despues de cargar perfiles
         *
         * Por que en serie y no en paralelo? Para respetar el orden visual
         * de las categorias y porque la deduplicacion global (seenUrls) depende
         * del orden de procesamiento. Si se cargaran en paralelo, un mismo
         * resultado podria aparecer en dos categorias antes de ser deduplicado.
         *
         * @returns {Promise<void>}
         */
        init: async function() {
            // Orden de carga: perfiles primero (para llenar el filtro de facultad)
            const ORDER = ['profiles', 'organizations', 'programs', 'publications'];

            // Inicializar estado de cada categoria con valores por defecto
            ORDER.forEach(k => { this.state[k] = { expanded: false, data: null, filteredData: null }; });

            // Construir la toolbar de ordenamiento y filtros
            buildToolbar();

            // --- Boton "Volver arriba" ---
            // Boton flotante que aparece cuando el usuario hace scroll hacia abajo
            // Permite volver rapidamente al inicio de la pagina
            if (!document.getElementById('hub-back-to-top')) {
                const btt = document.createElement('button');
                btt.id = 'hub-back-to-top';
                btt.className = 'hub-back-to-top';
                btt.setAttribute('aria-label', 'Volver al inicio');
                btt.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
                btt.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
                document.body.appendChild(btt);

                // Mostrar/ocultar el boton segun la posicion de scroll
                // Aparece cuando el usuario baja mas de 400px
                window.addEventListener('scroll', () => {
                    if (window.scrollY > 400) btt.classList.add('visible');
                    else btt.classList.remove('visible');
                });
            }

            // --- Carga secuencial de categorias ---
            try {
                for (const k of ORDER) {
                    // Cargar cada categoria una por una (await garantiza orden)
                    await this.loadCategory(k);
                    // Despues de cargar perfiles, llenar el dropdown de facultades
                    // porque necesita los datos de departamento de los investigadores
                    if (k === 'profiles') populateFacultyFilter();
                }
            } catch (e) {
                console.error('[HUB Dashboard v17.0] Error en inicializacion:', e);
            }
        }
    };

    // --- ARRANQUE: Iniciar el dashboard ---
    // Se llama inmediatamente al montar el objeto global
    window.HUB_DASHBOARD.init();
});
