<#-- $This file is distributed under the terms of the license in LICENSE$ -->
<#--
  ============================================================================
  🌐 HUB VIVO - Plantilla de Búsqueda Facetada (Partner)
  ============================================================================
  Esta plantilla es renderizada por el servlet Java `PagedSearchControllerFaceted`
  configurado para el endpoint `/find-a-partner`.

  ⚠️ VARIABLES INYECTADAS ESPERADAS:
  - `querytext`: (String) Término de búsqueda del usuario.
  - `facets`: (List<SearchFacet>) Conteos Solr por área de investigación y facultad.
  - `individuals`: (List) Resultado de personas tipo `foaf:Person + vlocal:UREntity`.
  - `pagingLinks`: (List) Paginación AJAX.
  - `sort`: (String) Criterio activo (nameLowercaseSingleValued|ASC, numPublications|DESC, numGrants|DESC).

  📊 ORDEN DE CLASIFICACIÓN ESPECÍFICO DE PARTNER:
  A diferencia del Supervisor, este buscador ofrece dos criterios de relevancia:
  - "Por publicaciones" → numPublications|DESC
  - "Por grants" → numGrants|DESC
  Ambos campos deben existir en el esquema de Solr para funcionar.

  ⚠️ INTEGRACIÓN JAVASCRIPT:
  - `urlBaseForFilterSearch` es inyectado en `window` para que `dynamic-filters4.js` sepa
    a qué endpoint enviar las peticiones AJAX de los filtros.
  ============================================================================
-->

<h2 class="searchResultsHeader">
<#escape x as x?html>
    ${i18n().search_results_for} '${querytext}'
    <#if classGroupName?has_content>${i18n().limited_to_type} '${classGroupName}'</#if>
    <#if typeName?has_content>${i18n().limited_to_type} '${typeName}'</#if>
</#escape>
<script type="text/javascript">
	var url = window.location.toString();
	if (url.indexOf("?") == -1){
		var queryText = 'querytext=${querytext?js_string}';
	} else {
		var urlArray = url.split("?");
		var queryText = urlArray[1];
	}

	var urlsBase = '${urls.base}';
</script>

	<img id="downloadIcon" src="images/download-icon.png" alt="${i18n().download_results}" title="${i18n().download_results}" />
<#-- <span id="downloadResults" style="float:left"></span>  -->
</h2>

<span id="searchHelp"><a href="${urls.base}/searchHelp" title="${i18n().search_help}">${i18n().not_expected_results}</a></span>

<div class="contentsBrowseGroup clear clearfix">

    <#-- Facets -->
    <#if facets?has_content>
     <div class="search_partner">
       <div id="js-loading-overlayer">
          <div class='js-loading-overlayer-text'>${i18n().applyingFilter}</div>
       </div>

       <form id="search-partner" class="js-search-form" action="${urls.base}/find-a-partner" method="GET">

         <input type="hidden" name="classgroup" value="http://vivoweb.org/ontology#vitroClassGrouppeople"/>
        <!-- Caja de busqueda--> 
		      <div class="search_partner-box">
            <h4 class="search_partner-title">${i18n().find_partner}</h4>
            <input type="text" id="facets-querytext"  name="querytext" autocomplete="off" class="search_partner-input-w100 js-query-text" value="${querytext!?html}"/>


            <#--  CHECKBOX JEYWORD PATHERNAME  -->
            <#--  <#if searchBy?? && searchBy == "keyword">
              <label class="search_partner-label" for="searchByKeyword">
                <input type="radio" class="search_partner-input" id="searchByKeyword" name="searchBy" value="keyword" checked>
                <div class="search_partner-radio-placeholder"></div>
              Keyword</label>
            <#else>
              <label class="search_partner-label" for="searchByKeyword">
                <input type="radio" class="search_partner-input" id="searchByKeyword" name="searchBy" value="keyword">
                <div class="search_partner-radio-placeholder"></div>
              Keyword</label>
            </#if>


            <#if searchBy?? && searchBy == "name">
              <label class="search_partner-label" for="searchByName">
                <input type="radio" class="search_partner-input" id="searchByName" name="searchBy" value="name" checked>
                <div class="search_partner-radio-placeholder"></div>
              Partner Name</label>
            <#else>
              <label class="search_partner-label" for="searchByName">
                <input type="radio" class="search_partner-input" id="searchByName" name="searchBy" value="name">
                <div class="search_partner-radio-placeholder"></div>
              Partner Name</label>
            </#if>  -->
         </div>
		<!-- FIN Caja de busqueda--> 

         <#list facets as facet>
            <div class="search_partner-box js-checkbox-facet" id="${facet.baseName}">
            <div class="js-loader">
              <span></span>
              <span></span>
              <span></span>
            </div>
              <h4 class="search_partner-title js-facet-title">${facet.publicName}</h4>
                <div class="js-all-inputs-box">

              <#list facet.categories as category>
                <#if category.selected>
                  <label class="search_partner-label" for="${facet.fieldName}-${category.id}">
                    <input type="checkbox" class="search_partner-input" id="${facet.fieldName}-${category.id}" name="${facet.fieldName}" value="${category.label}" checked>
                    <div class="search_partner-checkbox-placeholder"></div>
                  ${category.label}</label>
                <#else>
                  <label class="search_partner-label" for="${facet.fieldName}-${category.id}">
                    <input type="checkbox" class="search_partner-input" id="${facet.fieldName}-${category.id}" name="${facet.fieldName}" value="${category.label}">
                    <div class="search_partner-checkbox-placeholder"></div>
                  ${category.label}</label>
                </#if>
              </#list>
              </div>
            </div>
        </#list>
        <!-- <input type="submit" name="facets-submit" value="Apply Filters"/> -->
        <script 
          type="text/javascript"> var urlBaseForFilterSearch = '${urls.base}' + '/find-a-partner' 
        </script>

       </form>
     </div>
    </#if>


  <div class="search_results js-results-container">
    <#--  ################Sort search results##################  -->
    <script type="text/javascript">
      $(document).ready(function () {
        $('.research_outputs').attr('style', 'display:none !important');
        $('.grants').attr('style', 'display:none !important');
      });
    </script>

    <div class="search_partner-box sort-search-box">
      <h4 class="search_partner-title">${i18n().sortBy}</h4>
      <select id="sort" name="sort" class="search_partner-input-w100 search_partner-select js-search">
			<#-- Ordenar por numero de publicaciones JCCJ (Predeterminado) -->
			<#if sort?? && sort == "numPublications|DESC">
			   <option value="numPublications|DESC" selected>${i18n().relevance}</option>
			<#else>
			   <option value="numPublications|DESC" selected>${i18n().relevance}</option>
			</#if>
			
			<#if sort?? && sort == "numGrants|DESC">
			   <option value="numGrants|DESC" selected>${i18n().relevanceGrants}</option>
			<#else>
			   <option value="numGrants|DESC">${i18n().relevanceGrants}</option>
			</#if>

        <#if sort?? && sort == "nameLowercaseSingleValued|ASC">
          <option value="nameLowercaseSingleValued|ASC">${i18n().alphabetical} (A-Z)</option>
        <#else>
          <option value="nameLowercaseSingleValued|ASC">${i18n().alphabetical} (A-Z)</option>
        </#if>
      </select>
    </div>

    <#-- Search results -->
    <ul class="searchhits js-search-hits" id="wrapper-results">
        <#list individuals as individual>
          <li>
         	  <@shortView uri=individual.uri viewContext="search"/>
          </li>
        </#list>
    </ul>

    <#-- Paging controls -->
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

  <#-- Refinement links -->
  <#--  <#if classGroupLinks?has_content>
      <div class="searchTOC">
          <h4>${i18n().display_only}</h4>
          <ul>
          <#list classGroupLinks as link>
              <li><a href="${link.url}" title="${i18n().class_group_link}">${link.text}</a><span>(${link.count})</span></li>
          </#list>
          </ul>
      </div>
  </#if>  -->

  <#--  <#if classLinks?has_content>
      <div class="searchTOC">
          <#if classGroupName?has_content>
              <h4>${i18n().limit} ${classGroupName} ${i18n().to}</h4>
          <#else>
              <h4>${i18n().limit_to}</h4>
          </#if>
          <ul>
          <#list classLinks as link>
              <li><a href="${link.url}" title="${i18n().class_link}">${link.text}</a><span>(${link.count})</span></li>
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
                }
                else {  // remove these gadgets
                    my.removeGadgets(searchGadgets);
                }
            </script>

            <div id="gadgets-search" class="gadgets-gadget-parent" style="display:inline-block"></div>
        </#if>
    </#if>

</div> <!-- end contentsBrowseGroup -->
	<#--  <script type="text/javascript">
		$(document).ready(function () {	
			   $('.thesis').hide();
		});
	</script>  -->
	
${stylesheets.add('    <link rel="stylesheet" href="//code.jquery.com/ui/1.10.3/themes/smoothness/jquery-ui.css" />',
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
