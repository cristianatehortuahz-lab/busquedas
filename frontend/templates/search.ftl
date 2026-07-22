<#-- $This file is distributed under the terms of the license in LICENSE$ -->
<#--
  ============================================================================
  🌐 HUB VIVO - Plantilla de Búsqueda Global (Barra Principal)
  ============================================================================
  Este archivo es el formulario raíz de la búsqueda en VIVO. Se incrusta
  en el tema activo (`wilma`) y puede ser reutilizado por otras páginas y
  herramientas avanzadas (JSP admin tools).

  ⚠️ VARIABLES INYECTADAS ESPERADAS:
  - `urls.search`: (String) URL del endpoint de búsqueda. VIVO la resuelve automáticamente.
  - `querytext`: (String) Término de búsqueda previo (para rellenar el campo al volver a la página).

  📝 NOTA ARQUITECTÓNICA:
  Este archivo NO contiene lógica de resultados. Solo genera el `<form>` de entrada.
  Los resultados y facetas se procesan en `search-find-a-*.ftl` según el endpoint.
  El `<input id="filter_input_querytext">` es el ancla que usa el autocompletado
  en combinación con `autocomplete.js`.
  ============================================================================
-->

<section id="search" role="region">
    <fieldset>
        <legend>${i18n().search_form}</legend>

        <form id="search-form" action="${urls.search}" autocomplete="off" name="search" role="search" accept-charset="UTF-8" method="GET">
            <div id="search-field">
                <input type="text" id="filter_input_querytext" name="querytext" class="search-vivo" value="${querytext!?html}" autocapitalize="off" />
                <input type="submit" value="${i18n().search_button}" class="search">
            </div>
        </form>
    </fieldset>
</section>

