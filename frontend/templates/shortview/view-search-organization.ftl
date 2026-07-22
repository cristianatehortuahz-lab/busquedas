
<#ftl encoding="UTF-8">
<#--
  ============================================================================
  🌐 HUB VIVO - Short View: Organización (Laboratorio / Grupo)
  ============================================================================
  Esta plantilla renderiza la tarjeta de cada resultado de tipo organización
  en el buscador `/find-a-lab` (y cualquier búsqueda que devuelva laboratorios).

  ⚠️ VARIABLES INYECTADAS:
  - `individual.name`: Nombre de la organización.
  - `individual.profileUrl`: URL del perfil en VIVO.
  - `individual.vclassUri`: URI ontológico de la clase.
  - `OrganizationOverview[0].OrgOverview`: (String) Descripción del laboratorio,
    proveniente de la propiedad `rdfs:comment` del individuo VIVO.

  📝 LÓGICA DE TRUNCADO:
  Si `OrgOverview` tiene más de 400 caracteres, se muestra solo el fragmento
  inicial y se agrega un enlace "ver más" apuntando al perfil completo.
  Esto evita tarjetas excesivamente largas en el sidebar de resultados.
  ============================================================================
-->
<#import "lib-properties.ftl" as p>

<#--  ${stylesheets.add('<link rel="stylesheet" type="text/css" href="${urls.base}/themes/wilma/css/shortView/shortViewOrganization.css"/>')}  -->

<#if individual.name?has_content>
    <div class="individual" role="listitem" role="navigation" id="organizationIndividual" data-vclass="${individual.vclassUri!}">
        <div class="org-desc">
                 <a href="${individual.profileUrl}" title="Ver la p&aacute;gina de perfil de ${individual.name}">${individual.name}</a>
            <#if (OrganizationOverview[0].OrgOverview)?? >
                <#if OrganizationOverview[0].OrgOverview?length <= 400>
                <span class="title">${OrganizationOverview[0].OrgOverview}</span>
                <#else>
                <span class="title">${OrganizationOverview[0].OrgOverview?substring(0,400)}... <a class="blue-text"  href="${individual.profileUrl}" target="_blank">ver m&aacute;s</a> </span>
                </#if>
            </#if>
        </div>
    </div>
</#if>

