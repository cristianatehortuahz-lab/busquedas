# 01 - Arquitectura de 3 Capas

El Buscador Facetado HUB-UR está construido sobre una arquitectura estricta de 3 capas. Mantener esta separación es vital para el rendimiento y la mantenibilidad.

## Capa 1: Presentación (Frontend SPA)
**Ubicación:** `busquedas/frontend/` (Se despliega en Tomcat bajo
`/opt/tomcat/webapps/HUBvivo115/` — la webapp es `HUBvivo115`, **no** `ROOT`)

Es una Single Page Application (SPA) construida con Vanilla JS (ES6) y FreeMarker. 
- **Agnóstica del Entorno:** El código JS nunca hace hardcode de URLs (como `localhost` o IPs fijas). Se basa en la variable `urls.base` que VIVO inyecta en el objeto global de `window`.
- **Plantillas `.ftl`:** Actúan como el "esqueleto" de la UI. FreeMarker las renderiza en el servidor una única vez, y a partir de ahí, JavaScript toma el control (manejo de DOM, llamadas AJAX, inyección de tarjetas de resultados).

## Capa 2: Lógica y Control (Java Servlets)
**Ubicación:** `busquedas/backend/` (Se compila y despliega en
`/opt/tomcat/webapps/HUBvivo115/WEB-INF/classes/`)

El backend de VIVO (Tomcat) actúa como un orquestador ligero:
- **`PagedSearchControllerFaceted`**: Intercepta la petición HTTP, parsea los parámetros de filtro (ej: `facet_expertiseAreas=Biología`) y formula una consulta optimizada para el motor de indexación.
- **Inyección XML:** No hay lógica *hardcodeada* por cada buscador. Todos los buscadores (`/find-a-supervisor`, `/find-a-partner`, etc.) usan **la misma clase Java**, pero instanciada con diferentes parámetros (`init-param`) en `web.xml`.

## Capa 3: Indexación y Búsqueda Vectorial (Solr 7.4)
**Ubicación:** Servidor externo o instancia local en `http://localhost:8983/solr/vivocore`

Solr es el motor real del buscador. Tomcat no busca en la base de datos RDF (Jena) directamente porque sería extremadamente lento. En su lugar:
- VIVO indexa asíncronamente los cambios del RDF hacia Solr.
- Solr calcula los `Facet Counts` (ej: Cuántos supervisores hay en la "Facultad de Medicina") en milisegundos mediante consultas vectoriales invertidas.
- **Dependencia:** Si un campo no existe en `schema.xml` como `facet="true"`, el filtro en la UI no funcionará.

---
> **Para Desarrolladores:** Si necesitas cambiar un comportamiento visual, edita el JS/FTL. Si necesitas añadir un nuevo filtro, debes editar el `web.xml` (Capa 2) y el `schema.xml` de Solr (Capa 3).
