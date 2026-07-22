/**
 * ============================================================================
 * searchDownload.js — Widget de descarga/exportacion de resultados de busqueda
 * ============================================================================
 *
 * Version: v5.9
 *
 * Descripcion:
 *   Este archivo agrega la funcionalidad de descarga y exportacion de
 *   resultados a las paginas de busqueda del sistema VIVO. Presenta al
 *   usuario un tooltip emergente (popup) anclado al icono de descarga,
 *   donde puede elegir entre exportar en formato XML o CSV, y configurar
 *   la cantidad maxima de registros a descargar.
 *
 * Dependencias:
 *   - jQuery: para manipulacion del DOM, inyeccion de estilos y manejo
 *     de eventos.
 *   - qTip2 (plugin de jQuery): para la creacion y gestion del tooltip
 *     emergente que contiene las opciones de descarga. El codigo esta
 *     envuelto en try/catch porque qTip puede no estar disponible en
 *     todas las paginas del sistema.
 *
 * Variables globales esperadas (definidas por la plantilla search.ftl):
 *   - urlsBase: URL base del servidor VIVO (ej: "https://hub-ur.example.com")
 *   - queryText: parametros de la busqueda actual codificados como query string
 *
 * Flujo de la interfaz de usuario (UI/UX):
 *   1. Al cargar la pagina, se inyectan estilos CSS para el tooltip.
 *   2. Se crea un tooltip qTip sobre el elemento #downloadIcon.
 *   3. Al hacer clic en el icono, aparece un popup con:
 *      - Enlace para descargar en XML (endpoint /search?xml=1)
 *      - Enlace para descargar en CSV (endpoint /search?csv=1)
 *      - Campo numerico para elegir la cantidad maxima de registros (10-1000)
 *      - Boton "CERRAR" para ocultar el tooltip
 *   4. El popup se posiciona en la esquina inferior derecha del icono.
 *   5. Al modificar el campo numerico, se actualizan dinamicamente los
 *      enlaces de descarga con el nuevo valor.
 *
 * Correccion v5.9:
 *   Se usa recorrido relativo del DOM (.closest('.qtip-content')) en lugar
 *   de selectores por ID para localizar los enlaces de descarga. Esto
 *   corrige un bug donde multiples instancias de qTip con los mismos IDs
 *   de elementos causaban que solo se actualizara la primera instancia.
 *
 * ============================================================================
 */

/* $This file is distributed under the terms of the license in LICENSE$ */
/* v5.9: Relative DOM traversal to fix qTip ID duplication bugs */

// Se ejecuta cuando el DOM esta completamente cargado (jQuery document ready)
$(document).ready(function(){

    // =========================================================================
    // INYECCION DE ESTILOS CSS
    // Se agregan estilos al <head> del documento para personalizar la apariencia
    // del tooltip qTip: tamano de fuente, sin limite de ancho, z-index alto
    // para que aparezca sobre otros elementos, fondo blanco con bordes
    // redondeados y sombra suave.
    // =========================================================================
    $('head').append('<style id="downloadCSS">'
        +'.qtip { font-size: 14px; max-width: none !important; z-index: 9999 !important; }'
        +'.downloadTip { background: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.15); }'
        +'.downloadTip .qtip-content { padding: 0 !important; }'
        +'</style>');

    // =========================================================================
    // FUNCION GLOBAL: _dlUpdate
    // Se expone en el objeto window para que pueda ser llamada desde los
    // atributos oninput/onchange del campo numerico dentro del HTML del tooltip.
    //
    // Parametro:
    //   inputElem - el elemento <input> de tipo number que el usuario modifico
    //
    // Que hace:
    //   1. Lee el valor ingresado por el usuario
    //   2. Lo restringe al rango valido (minimo 10, maximo 1000, por defecto 500)
    //   3. Busca los enlaces de descarga CSV y XML dentro del MISMO tooltip
    //      usando recorrido relativo del DOM (.closest) en vez de IDs globales
    //   4. Actualiza el parametro documentsNumber en las URLs de ambos enlaces
    //
    // Por que recorrido relativo del DOM:
    //   Si hay varias instancias de qTip en la pagina, todas tendrian elementos
    //   con los mismos IDs (#csvDownload, #xmlDownload). Usar selectores por ID
    //   siempre encontraria solo el primero. Con .closest('.qtip-content') nos
    //   aseguramos de modificar los enlaces del tooltip correcto (v5.9).
    // =========================================================================
    window._dlUpdate = function(inputElem) {
        // Obtener el valor actual del campo numerico
        var val = inputElem.value;
        // Validar y restringir: minimo 10, maximo 1000; si no es numero, usar 500
        val = Math.max(10, Math.min(1000, parseInt(val) || 500));

        // Navegar hacia arriba en el DOM hasta encontrar el contenedor del tooltip actual
        var container = $(inputElem).closest('.qtip-content');
        // Buscar el enlace CSV dentro de este tooltip especifico
        var csvLink = container.find('a[href*="csv=1"]');
        // Buscar el enlace XML dentro de este tooltip especifico
        var xmlLink = container.find('a[href*="xml=1"]');

        // Actualizar el parametro documentsNumber en el enlace CSV si existe
        if (csvLink.length && csvLink.attr('href')) {
            csvLink.attr('href', csvLink.attr('href').replace(/documentsNumber=\d+/, 'documentsNumber=' + val));
        }
        // Actualizar el parametro documentsNumber en el enlace XML si existe
        if (xmlLink.length && xmlLink.attr('href')) {
            xmlLink.attr('href', xmlLink.attr('href').replace(/documentsNumber=\d+/, 'documentsNumber=' + val));
        }
    };

    // =========================================================================
    // CREACION DEL TOOLTIP qTip
    // Se envuelve en try/catch porque el plugin qTip2 puede no estar cargado
    // en todas las paginas del sistema VIVO. Si no esta disponible, se muestra
    // una advertencia en consola sin interrumpir la ejecucion de otros scripts.
    // =========================================================================
	try {
        // Inicializar el tooltip qTip sobre el icono de descarga (#downloadIcon)
        $('img#downloadIcon').qtip(
            {
                // Pre-renderizar el tooltip al cargar la pagina (no esperar al primer clic)
                prerender: true,
                content: {
                    // Contenido HTML del tooltip: estructura del popup de descarga
                    // Se construye como cadena concatenada con las variables globales
                    // urlsBase y queryText que provienen de la plantilla search.ftl
                    text:  '<div class="download-popup-container">'
                        // --- Seccion izquierda: opciones de descarga ---
                        +    '<div class="download-options-side">'
                        // Titulo del popup
                        +        '<div class="download-header">Descargar resultados de b&uacute;squeda</div>'
                        // Enlace de descarga XML: apunta al endpoint /search con parametro xml=1
                        // Incluye un icono SVG de descarga y el valor inicial de 500 registros
                        +        '<div class="download-url"><a id="xmlDownload" href="'+urlsBase+'/search?'+queryText+'&xml=1&documentsNumber=500"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Descargar en XML</a></div>'
                        // Enlace de descarga CSV: apunta al endpoint /search con parametro csv=1
                        // Misma estructura que el enlace XML pero con formato CSV
                        +        '<div class="download-url"><a id="csvDownload" href="'+urlsBase+'/search?'+queryText+'&csv=1&documentsNumber=500"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Descargar en CSV</a></div>'
                        +    '</div>'
                        // --- Seccion derecha: configuracion y cierre ---
                        +    '<div class="download-settings-side">'
                        // Etiqueta para el campo de cantidad maxima de registros
                        +        '<label>M&aacute;ximo de registros</label>'
                        // Campo numerico: rango 10-1000, incremento de 10, valor inicial 500
                        // Los eventos oninput y onchange llaman a _dlUpdate para actualizar
                        // dinamicamente las URLs de descarga cuando el usuario cambia el valor
                        +        '<input type="number" id="download-amount" min="10" max="1000" step="10" value="500" oninput="window._dlUpdate(this)" onchange="window._dlUpdate(this)" />'
                        // Boton de cierre del tooltip (su comportamiento se define mas abajo)
                        +        '<a class="close" href="#">CERRAR</a>'
                        +    '</div>'
                        + '</div>'
                },
                // Configuracion de posicionamiento del tooltip
                position: {
                    my: 'top right',      // Esquina del tooltip que se ancla
                    at: 'bottom right',   // Esquina del icono donde se ancla el tooltip
                    adjust: { x: 10, y: 5 } // Ajuste fino en pixeles (horizontal y vertical)
                },
                // Mostrar el tooltip al hacer clic en el icono
                show: {
                    event: 'click'
                },
                // Ocultar el tooltip al hacer clic nuevamente (toggle)
                hide: {
                    event: 'click'
                },
                // Estilos visuales del tooltip
                style: {
                    classes: 'downloadTip', // Clase CSS personalizada definida arriba
                    width: 460              // Ancho fijo del tooltip en pixeles
                }
            });
    } catch(e) { console.warn("qTip no disponible"); }

    // =========================================================================
    // MANEJADOR DEL BOTON "CERRAR"
    // Se usa delegacion de eventos ($(document).on) para capturar clics en
    // enlaces con clase "close" que se encuentran dentro del contenido del
    // tooltip (generado dinamicamente). Al hacer clic:
    //   1. Se oculta el tooltip llamando a qtip("hide")
    //   2. Se retorna false para prevenir la navegacion al href="#" que
    //      causaria un scroll indeseado al inicio de la pagina
    // =========================================================================
    $(document).on('click', 'a.close', function() {
        $('#downloadIcon').qtip("hide");
        return false;
    });

});
