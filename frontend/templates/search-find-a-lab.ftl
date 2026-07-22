<#-- $This file is distributed under the terms of the license in LICENSE$ -->
<#--
  ============================================================================
  🌐 HUB VIVO - Plantilla de Búsqueda Facetada (Laboratorio)
  ============================================================================
  Renderizada por `PagedSearchControllerFaceted` en el endpoint `/find-a-lab`.
  Filtra por ontología: `http://vivoweb.org/ontology#vitroClassGrouporganizations`

  ⚠️ VARIABLES INYECTADAS ESPERADAS:
  - `querytext`: (String) Término de búsqueda (puede incluir prefijo `acNameStemmed:`).
  - `facets`: (List<SearchFacet>) Conteos Solr por facultad/área de laboratorio.
  - `individuals`: (List) Resultados de tipo `vivo:CoreLaboratory`.
  - `pagingLinks`: (List) Paginación AJAX.

  📝 SCRIPT ESPECIAL (LÍNEA ~129):
  Hay un `<script>` en línea que extrae el término limpio de la URL cuando el
  autocompletado inyecta el prefijo `acNameStemmed:"termino"`. Esto limpia el
  campo visible del input para que el usuario vea solo el texto buscado.
  Si el buscador falla con queries de autocompletado, revisar ese script primero.

  ⚠️ INTEGRACIÓN JAVASCRIPT:
  - Carga `dynamic-filters4.js` (v4 activa, no v3/v2).
  - `urlBaseForFilterSearch` apunta a `/find-a-lab`.
  ============================================================================
-->
<div class="row">
  <#--=====================RESULTADOS DE BUSQUEDA====================-->
  <h2 class="searchResultsHeader">
    <#escape x as x?html>
        ${i18n().search_results_for} '${querytext}'
      <#if classGroupName?has_content>${i18n().limited_to_type} '${classGroupName}'</#if>
      <#if typeName?has_content> ${i18n().limited_to_type} '${typeName}'</#if>
    </#escape>
    <script type="text/javascript">
      var url = window.location.toString();
      if (url.indexOf("?") == -1) {var queryText = 'querytext=${querytext?js_string}';}
      else {
        var urlArray = url.split("?");
        var queryText = urlArray[1];
      }
      var urlsBase = '${urls.base}';
    </script>
    <img id="downloadIcon" src="images/download-icon.png" alt="${i18n().download_results}" title="${i18n().download_results}" />
    <#-- <span id="downloadResults" style="float:left"></span> -->
  </h2>

  <#--=====================AYUDA====================-->
  <span id="searchHelp">
    <a href="${urls.base}/searchHelp" title="${i18n().search_help}">
      ${i18n().not_expected_results}
    </a>
  </span>

</div>

<div class="contentsBrowseGroup clear clearfix">
  <#--=====================RESULTADOS DE BUSQUEDA====================-->
  <#-- Facets -->
  <#if facets?has_content>
    <div class="search_laboratory">
      <div id="js-loading-overlayer">
        <div class='js-loading-overlayer-text'>${i18n().applyingFilter}</div>
      </div>
      <form id="search-supervisor" class="js-search-form" action="${urls.base}/find-a-lab" method="GET">
        <input type="hidden" name="classgroup" value="http://vivoweb.org/ontology#vitroClassGrouporganizations" />
        <div class="search_laboratory-box">
          <h4 class="search_laboratory-title">
            ${i18n().find_lab}
          </h4>
          <input type="text" id="facets-querytext" name="querytext" autocomplete="off" class="search_laboratory-input-w100 js-query-text" value="${querytext!?html}" />
          <#--===========input type="radio" por keyword=============-->
          <#--  <#if searchBy?? && searchBy=="keyword">
            <label class="search_laboratory-label" for="searchByKeyword">
              <input type="radio" class="search_laboratory-input" id="searchByKeyword" name="searchBy" value="keyword" checked>
              <div class="search_laboratory-radio-placeholder"></div>
              ${i18n().service_keyword}
            </label>
            <#else>
              <label class="search_laboratory-label" for="searchByKeyword">
                <input type="radio" class="search_laboratory-input" id="searchByKeyword" name="searchBy" value="keyword">
                <div class="search_laboratory-radio-placeholder"></div>
                ${i18n().service_keyword}
              </label>
          </#if>  -->
          <#--===========input type="radio" por equipment=============-->
          <#--  <#if searchBy?? && searchBy=="equipment">
            <label class="search_laboratory-label" for="searchByEquipment">
              <input type="radio" class="search_laboratory-input" id="searchByEquipment" name="searchBy" value="equipment" checked>
              <div class="search_laboratory-radio-placeholder"></div>
              ${i18n().service_equipment}
            </label>
          <#else>
              <label class="search_laboratory-label" for="searchByEquipment">
                <input type="radio" class="search_laboratory-input" id="searchByEquipment" name="searchBy" value="equipment">
                <div class="search_laboratory-radio-placeholder"></div>
                ${i18n().service_equipment}
              </label>
          </#if>  -->
          <#--===========input type="radio" por service-course=============-->
          <#--  <#if searchBy?? && searchBy=="service">
            <label class="search_laboratory-label" for="searchByService">
              <input type="radio" class="search_laboratory-input" id="searchByService" name="searchBy" value="service" checked>
              <div class="search_laboratory-radio-placeholder"></div>
              ${i18n().service_service}
            </label>
          <#else>
            <label class="search_laboratory-label" for="searchByService">
              <input type="radio" class="search_laboratory-input" id="searchByService" name="searchBy" value="service">
              <div class="search_laboratory-radio-placeholder"></div>
              ${i18n().service_service}
            </label>
          </#if>  -->
        </div>
        <#list facets as facet>
          <div class="search_laboratory-box js-checkbox-facet" id="${facet.baseName}">
              <div class="js-loader">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <h4 class="search_laboratory-title js-facet-title">
                ${facet.publicName}
              </h4>
            <div class="js-all-inputs-box">
              <#list facet.categories as category>
                <#if category.selected>
                  <label class="search_laboratory-label" for="${facet.fieldName}-${category.id}">
                    <input type="checkbox" class="search_laboratory-input" id="${facet.fieldName}-${category.id}" name="${facet.fieldName}" value="${category.label}" checked>
                    <div class="search_laboratory-checkbox-placeholder"></div>
                    ${category.label}
                  </label>
                <#else>
                  <label class="search_laboratory-label" for="${facet.fieldName}-${category.id}">
                    <input type="checkbox" class="search_laboratory-input" id="${facet.fieldName}-${category.id}" name="${facet.fieldName}" value="${category.label}">
                    <div class="search_laboratory-checkbox-placeholder"></div>
                    ${category.label}
                  </label>
                </#if>
              </#list>
            </div>
          </div>
        </#list>
        <!-- <input type="submit" name="facets-submit" value="Apply Filters"/> -->
        <script type="text/javascript"> var urlBaseForFilterSearch = '${urls.base}' + '/find-a-lab'
        </script>
      </form>
    </div>
  </#if>

<script>
  var query=window.location.href; query = query.split("acNameStemmed:");
  var queryText= query[1].replaceAll('"',""); queryText = queryText.replaceAll("%22",""); queryText=decodeURIComponent(queryText); console.log(decodeURIComponent(queryText)); document.getElementById("facets-querytext").value=queryText;
  var search_vivo= document.getElementsByClassName("search-vivo"); search_vivo[0].value= "";
</script> 

  <#--========================Cuadro de Resultados==============================-->
  <div class="search_results js-results-container">
    <#-- Sort search results -->
    <script type="text/javascript">
      $(document).ready(function() {
      $('.research_outputs').attr('style', 'display:none !important');
      $('.grants').attr('style', 'display:none !important');
      });
    </script>
    <#-- +++++++++++++cuadro clasificar por++++++++++ -->
    <div class="search_laboratory-box sort-search-box">
      <h4 class="search_laboratory-title">${i18n().sortBy}</h4>
      <select id="sort" name="sort" class="search_laboratory-input-w100 search_laboratory-select js-search">
        <#if sort?? && sort == "nameLowercaseSingleValued|ASC">
          <option value="nameLowercaseSingleValued|ASC" selected>${i18n().alphabetical} (A-Z)</option>
        <#else>
          <option value="nameLowercaseSingleValued|ASC">${i18n().alphabetical} (A-Z)</option>
        </#if>
        <#if sort?? && sort == "nameLowercaseSingleValued|DESC">
           <option value="nameLowercaseSingleValued|DESC" selected>${i18n().alphabetical} (Z-A)</option>
        <#else>
           <option value="nameLowercaseSingleValued|DESC">${i18n().alphabetical} (Z-A)</option>
        </#if>
      </select>
    </div>
    <#-- Search results -->
    <ul class="searchhits-Lab js-search-hits" id="wrapper-results">
      <#list individuals as individual>
        <li>
          <@shortView uri=individual.uri viewContext="search" />
        </li>
      </#list>
    </ul>

    <#if (pagingLinks?size > 0)>
        <div class="searchpages js-search-pages">
            <#-- <#if prevPage??><a class="prev" href="${prevPage}" title="${i18n().previous}">${i18n().previous}</a></#if> -->
            <#list pagingLinks as link>
                <#if link.url??>
                    <a href="${link.url}" title="${i18n().page_link}">${link.text}</a>
                <#else>
                    <a href="" class="js-active-page" title="${i18n().page_link}">${link.text}</a>
                </#if>
            </#list>
            <#-- <#if nextPage??><a class="next" href="${nextPage}" title="${i18n().next_capitalized}">${i18n().next_capitalized}</a></#if> -->
        </div>
    </#if>
  </div>

  <#--  <#list pagingLinks as link>
    <#if link.url??>
      <a href="${link.url}" title="${i18n().page_link}"> ${link.text} </a>
    <#else>
      <a href="" class="js-active-page" title="${i18n().page_link}"> ${link.text}</a>
    </#if>
  </#list>  -->


  
  <#-- Refinement links -->
  <#--  <#if classGroupLinks?has_content>
    <div class="searchTOC">
      <h4>
      ${i18n().display_only}
      </h4>
      <ul>
        <#list classGroupLinks as link>
          <li>
            <a href="${link.url}" title="${i18n().class_group_link}">${link.text}</a>
            <span>(${link.count})</span>
          </li>
        </#list>
      </ul>
    </div>
  </#if>  -->

  <#--  <#if classLinks?has_content>
    <div class="searchTOC">
      <#if classGroupName?has_content>
        <h4>
          ${i18n().limit} ${classGroupName} ${i18n().to}
        </h4>
      <#else>
        <h4>
          ${i18n().limit_to}
        </h4>
      </#if>
      <ul>
        <#list classLinks as link>
          <li><a href="${link.url}" title="${i18n().class_link}">
              ${link.text}
            </a><span>(${link.count})</span></li>
        </#list>
      </ul>
    </div>
  </#if>  -->

  <#-- VIVO OpenSocial Extension by UCSF -->
  <#if openSocial??>
    <#if openSocial.visible>
      <h3>OpenSocial</h3>
      <script type="text/javascript" language="javascript">
        // find the 'Search' gadget(s).
        var searchGadgets = my.findGadgetsAttachingTo("gadgets-search");
        var keyword = '${querytext?js_string}';
        // add params to these gadgets
        if (keyword) {
          for (var i = 0; i < searchGadgets.length; i++) {
            var searchGadget = searchGadgets[i];
            searchGadget.additionalParams = searchGadget.additionalParams || {};
            searchGadget.additionalParams["keyword"] = keyword;
        }
        } else { // remove these gadgets
          my.removeGadgets(searchGadgets);
        }
      </script>
      <div id="gadgets-search" class="gadgets-gadget-parent" style="display:inline-block"></div>
    </#if>
  </#if>
</div>
<#--============fin contentsBrowseGroup============-->
${stylesheets.add('
                  <link rel="stylesheet" href="//code.jquery.com/ui/1.10.3/themes/smoothness/jquery-ui.css" />',
                  '<link rel="stylesheet" href="${urls.base}/css/search.css" />',
                  '<link rel="stylesheet" href="${urls.base}/themes/wilma/css/shortView/shortViewService.css" />',
                  '<link rel="stylesheet" type="text/css" href="${urls.base}/css/jquery_plugins/qtip/jquery.qtip.min.css" />')}
${headScripts.add('
                  <script src="//code.jquery.com/ui/1.10.3/jquery-ui.js"></script>',
                  '<script type="text/javascript" src="${urls.base}/js/jquery_plugins/qtip/jquery.qtip.min.js"></script>',
                  '<script type="text/javascript" src="${urls.base}/js/tiny_mce/tiny_mce.js"></script>')}
${scripts.add('
              <script type="text/javascript" src="${urls.base}/js/searchDownload.js"></script>',
              '<script type="text/javascript" src="${urls.base}/themes/wilma/js/dynamic-filters4.js"></script>')}


                <#-- '<script type="text/javascript" src="${urls.base}/js/jquery_plugins/qtip/jquery.qtip-1.0.0-rc3.min.js"></script>' , -->