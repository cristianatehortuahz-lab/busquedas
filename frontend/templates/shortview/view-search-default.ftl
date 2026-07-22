<#ftl encoding="UTF-8">
<#--
  ============================================================================
  🌐 HUB VIVO - Short View: Entidad Genérica (Fallback)
  ============================================================================
  Esta plantilla es la vista de tarjeta por DEFECTO cuando ningún otro
  shortview especializado coincide con el `vclassUri` de la entidad.

  Contexto de uso: `/search` global y cualquier buscador sin shortview propio.

  ⚠️ VARIABLES INYECTADAS (por el engine de VIVO shortviews):
  - `individual.name`: Nombre a mostrar.
  - `individual.profileUrl`: URL del perfil completo en VIVO.
  - `individual.vclassUri`: URI de la clase ontológica (ej: `foaf:Person`).
  - `individual.snippet`: Fragmento de texto descriptivo desde el índice Solr.
  ============================================================================
-->
<#import "lib-vivo-properties.ftl" as p>

<div class="individual" data-vclass="${individual.vclassUri!}">
    <a href="${individual.profileUrl}" title="Ver perfil de ${individual.name}">${individual.name}</a>
    <@p.displayTitle individual />
    <p class="snippet">${individual.snippet}</p>
</div>
