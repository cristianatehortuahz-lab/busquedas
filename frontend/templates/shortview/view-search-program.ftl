<#ftl encoding="UTF-8">
<#--
  ============================================================================
  🌐 HUB VIVO - Short View: Programa Académico
  ============================================================================
  Renderiza la vista resumida (tarjeta) de un programa individual.
  Es consumido por el contenedor de resultados `/find-a-program`.

  ⚠️ PROPIEDADES MAPEADAS (Ontología VIVO):
  - `ProgramModality[0].modality`: Modalidad (ej: Virtual, Presencial).
  - `ProgramLevel[0].level`: Nivel formativo (ej: Maestría, Pregrado).
  - `ProgramSemester[0].semester`: Duración total en semestres.

  📝 DISEÑO UX/RESPONSIVO:
  Utiliza clases CSS de flexbox (`hub-program-card`) para estructurar
  la información con truncado dinámico de líneas (`line-clamp`).
  ============================================================================
-->
<#import "lib-properties.ftl" as p>

<div class="individual" role="listitem" role="navigation" id="programIndividual" data-vclass="${individual.vclassUri!}">
    <a href="${individual.profileUrl}" class="hub-program-card" title="Ver la página de perfil de ${individual.name}">
        <div class="hub-program-info" style="flex:1; overflow:hidden;">
            <span class="hub-program-name">${individual.name}</span>
            <span class="hub-program-desc" style="font-size:11px; color:var(--hub-gray-500); line-height:1.55; display:-webkit-box; -webkit-line-clamp:2; line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; margin-top:2px;">
                <#assign hasDetails = false>
                <#if (ProgramModality[0].modality)??>
                    <b>Modalidad:</b> ${ProgramModality[0].modality}
                    <#assign hasDetails = true>
                </#if>
                <#if (ProgramLevel[0].level)??>
                    <#if hasDetails> | </#if><b>Nivel:</b> ${ProgramLevel[0].level}
                    <#assign hasDetails = true>
                </#if>
                <#if (ProgramSemester[0].semester)??>
                    <#if hasDetails> | </#if><b>Duraci&oacute;n:</b> ${ProgramSemester[0].semester}
                    <#assign hasDetails = true>
                </#if>
                <#if !hasDetails>
                    Programa acad&eacute;mico ofrecido por la Universidad del Rosario. Pulse aqu&iacute; para consultar en detalle el curr&iacute;culo, profesores y objetivos.
                </#if>
            </span>
        </div>
    </a>
</div>
