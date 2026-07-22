<#-- $This file is distributed under the terms of the license in LICENSE$ -->
<#--
  ============================================================================
  🌐 HUB VIVO - Plantilla de Búsqueda Facetada (Speaker / Presentador)
  ============================================================================
  Renderizada por `PagedSearchControllerFaceted` en el endpoint `/find-a-speaker`.
  Filtra por ontología: `vivo:presentador`

  ⚠️ VARIABLES INYECTADAS ESPERADAS:
  - `querytext`: (String) El término buscado (puede incluir prefijo `acNameStemmed:`).
  - `facets`: (List<SearchFacet>) Conteos por tema de conferencia, idioma y modalidad.
  - `individuals`: (List) Resultados de tipo presentador.
  - `pagingLinks`: (List) Paginación AJAX.

  🔔 DIFERENCIAS CON LOS OTROS BUSCADORES:
  1. Este FTL aún conserva los radio buttons `searchBy` ("Conference topics" / "Speaker Name")
     activos. En los otros buscadores están comentados.
  2. Carga `dynamic-filters3.js` (v3, NO v4). Revisar si se debe actualizar.
  3. Tiene strings hardcodeados en inglés ("Find a Speaker", "Sort by:", "Applying Filters")
     que no están internacionalizados con `i18n()`. Revisar antes de desplegar en producción.

  ⚠️ INTEGRACIóN JAVASCRIPT:
  - `urlBaseForFilterSearch` apunta a `/find-a-speaker`.
  ============================================================================
-->

<h2 class="searchResultsHeader">
<#escape x as x?html>
    <#assign textShow = querytext?replace('acNameStemmed:','')>
    ${i18n().search_results_for} '${textShow}'
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
	<#if classLinks?has_content>${i18n().limited_to_type} 
	</#if>
</h2>

<span id="searchHelp"><a href="${urls.base}/searchHelp" title="${i18n().search_help}">${i18n().not_expected_results}</a></span>
<div class="contentsBrowseGroup clear clearfix">

    <#-- Facets -->
    <#if facets?has_content>
     <div class="search_supervisor">
       <div id="js-loading-overlayer">
          <div class='js-loading-overlayer-text'>Applying Filters</div>
       </div>

        <form id="search-supervisor" class="js-search-form" action="${urls.base}/find-a-speaker" method="GET">

         <div class="search_supervisor-box">
            <h4 class="search_supervisor-title">Find a Speaker</h4>
            <input type="text" id="facets-querytext"  name="querytext" autocomplete="off" class="search_supervisor-input-w100 js-query-text" value="${querytext!?html}"/>

            <#if searchBy?? && searchBy == "keyword">
              <label class="search_supervisor-label" for="searchByKeyword">
                <input type="radio" class="search_supervisor-input" id="searchByKeyword" name="searchBy" value="keyword" checked>
                <div class="search_supervisor-radio-placeholder"></div>
              Conference topics</label>
            <#else>
              <label class="search_supervisor-label" for="searchByKeyword">
                <input type="radio" class="search_supervisor-input" id="searchByKeyword" name="searchBy" value="keyword">
                <div class="search_supervisor-radio-placeholder"></div>
              Conference topics</label>
            </#if>


            <#if searchBy?? && searchBy == "name">
              <label class="search_supervisor-label" for="searchByName">
                <input type="radio" class="search_supervisor-input" id="searchByName" name="searchBy" value="name" checked>
                <div class="search_supervisor-radio-placeholder"></div>
              Speaker Name</label>
            <#else>
              <label class="search_supervisor-label" for="searchByName">
                <input type="radio" class="search_supervisor-input" id="searchByName" name="searchBy" value="name">
                <div class="search_supervisor-radio-placeholder"></div>
              Speaker Name</label>
            </#if>
         </div>

         <#list facets as facet>
            <div class="search_supervisor-box js-checkbox-facet" id="${facet.baseName}">
            <div class="js-loader">
              <span></span>
              <span></span>
              <span></span>
            </div>

              <h4 class="search_supervisor-title js-facet-title">${facet.publicName}</h4>
                <div class="js-all-inputs-box">

              <#list facet.categories as category>
                <#if category.selected>
                  <label class="search_supervisor-label" for="${facet.fieldName}-${category.id}">
                    <input type="checkbox" class="search_supervisor-input" id="${facet.fieldName}-${category.id}" name="${facet.fieldName}" value="${category.label}" checked>
                    <div class="search_supervisor-checkbox-placeholder"></div>
                  ${category.label}</label>
                <#else>
                  <label class="search_supervisor-label" for="${facet.fieldName}-${category.id}">
                    <input type="checkbox" class="search_supervisor-input" id="${facet.fieldName}-${category.id}" name="${facet.fieldName}" value="${category.label}">
                    <div class="search_supervisor-checkbox-placeholder"></div>
                  ${category.label}</label>
                </#if>
              </#list>
                </div>
            </div>
        </#list>
        ${scripts.add('<script type="text/javascript" src="${urls.base}/themes/wilma/js/dynamic-filters4.js"></script>')}
        <script type="text/javascript"> var urlBaseForFilterSearch = '${urls.base}' + '/find-a-speaker' </script>

       </form>
     </div>
    </#if>

<script>
var query=window.location.href;
query = query.split("acNameStemmed:");
var queryText= query[1].replaceAll('"',"");
queryText = queryText.replaceAll("%22","");
queryText=decodeURIComponent(queryText);
console.log(decodeURIComponent(queryText));
document.getElementById("facets-querytext").value=queryText;
var search_vivo= document.getElementsByClassName("search-vivo");
search_vivo[0].value= "";
</script>

  <div class="search_results js-results-container">
    <#-- Sort search results -->
		<script type="text/javascript">
		$(document).ready(function () {	
			   $('.research_outputs').attr('style','display:none !important');
			   $('.grants').attr('style','display:none !important');
		});
	</script>
    <div class="search_supervisor-box sort-search-box">
      <h4 class="search_supervisor-title">Sort by:</h4>
      <select id="sort" name="sort" class="search_supervisor-input-w100 search_supervisor-select js-search">
        <#if sort?? && sort == "nameLowercaseSingleValued|ASC">
          <option value="nameLowercaseSingleValued|ASC" selected>Alphabetical (A-Z)</option>
        <#else>
          <option value="nameLowercaseSingleValued|ASC">Alphabetical (A-Z)</option>
        </#if>
        <#if sort?? && sort == "nameLowercaseSingleValued|DESC">
           <option value="nameLowercaseSingleValued|DESC" selected>Alphabetical (Z-A)</option>
        <#else>
           <option value="nameLowercaseSingleValued|DESC">Alphabetical (Z-A)</option>
        </#if>

		
      </select>
    </div>
	
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


    <ul class="searchhits js-search-hits" id="wrapper-results">
        <#list individuals as individual>
            	<@shortView uri=individual.uri viewContext="search"/>
					    <#-- Sort search results -->
        </#list>
    </ul>

  </div>



  <#-- Refinement links -->
  <#if classGroupLinks?has_content>
      <!-- div class="searchTOC">
          <h4>${i18n().display_only}</h4>
          <ul>
          <#list classGroupLinks as link>
              <li><a href="${link.url}" title="${i18n().class_group_link}">${link.text}</a><span>(${link.count})</span></li>
          </#list>
          </ul>
      </div-->
  </#if>

  <#if classLinks?has_content>
      <!--div class="searchTOC">
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
      </div --!>
  </#if>

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

${stylesheets.add('<link rel="stylesheet" href="//code.jquery.com/ui/1.10.3/themes/smoothness/jquery-ui.css" />',
  				  '<link rel="stylesheet" href="${urls.base}/css/search.css" />',
                  '<link rel="stylesheet" type="text/css" href="${urls.base}/css/jquery_plugins/qtip/jquery.qtip.min.css" />')}

${headScripts.add('<script src="//code.jquery.com/ui/1.10.3/jquery-ui.js"></script>',
				  '<script type="text/javascript" src="${urls.base}/js/jquery_plugins/qtip/jquery.qtip-1.0.0-rc3.min.js"></script>',
                  '<script type="text/javascript" src="${urls.base}/js/tiny_mce/tiny_mce.js"></script>'
                  )}

${scripts.add('<script type="text/javascript" src="${urls.base}/js/searchDownload.js"></script>')}


