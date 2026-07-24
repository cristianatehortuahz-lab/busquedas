# 📚 Documentación Técnica: Buscador Facetado HUB-UR

Esta guía está diseñada para **futuros desarrolladores** que necesiten auditar, depurar o expandir el sistema de búsqueda de la plataforma VIVO. 

### 📑 Documentos de esta carpeta

| Documento | Contenido |
|---|---|
| **README.md** (este) | Flujo de una búsqueda, arquitectura por capas, troubleshooting |
| [`01-arquitectura.md`](01-arquitectura.md) | Arquitectura de 3 capas en detalle |
| [`02-auditoria-practicas.md`](02-auditoria-practicas.md) | Auditoría LOCAL vs paquete de prácticas |
| [`03-despliegue.md`](03-despliegue.md) | Despliegue en servidor (rutas, pasos) |
| [`04-configuracion.md`](04-configuracion.md) | Configuración por ambiente |
| [`05-relevancia-solr.md`](05-relevancia-solr.md) | Relevancia: ranking en Solr + sinónimos + corte por nombre |

---

## 🔄 1. Flujo de una Búsqueda Facetada (Ciclo de Vida)

El siguiente es el ciclo de vida exacto desde que un usuario intenta buscar algo hasta que ve los resultados filtrados en pantalla.

```text
[Navegador] 1. Usuario accede a /find-a-supervisor (o partner, program, lab, speaker)
     │
[Tomcat]    2. El servlet `PagedSearchControllerFaceted` recibe la petición HTTP GET.
     │         └─ Lee sus parámetros de arranque (init-params) definidos en `web.xml`.
     │
[SolrJ]     3. El Servlet se comunica con Solr pasándole:
     │         └─ `querytext` (lo que el usuario tipeó)
     │         └─ Filtro ontológico base (ej: `foaf:Person`)
     │         └─ Campos facetados requeridos (ej: `facet_expertiseAreas`)
     │
[Solr]      4. Solr calcula vectorialmente los `hits` (resultados) y los `facet counts`.
     │
[Tomcat]    5. El servlet construye el modelo de datos (JSON/Map) y renderiza la vista.
     │         └─ Llama a `search-find-a-supervisor.ftl`.
     │
[Navegador] 6. El navegador procesa la vista y ejecuta `dynamic-filters4.js`.
     │         └─ El script intercepta el formulario de facetas.
     │         └─ Convierte cualquier clic de paginación o filtro en AJAX puro.
     │
[AJAX]      7. Al marcar una faceta, el flujo se repite pero actualizando solo el DOM.
```

---

## 🏛️ 2. Arquitectura de Archivos por Capa

Para modificar algo, necesitas saber a qué capa pertenece el componente.

### Capa 1: Presentación (Motor FreeMarker)

Ubicación en el servidor: `/opt/tomcat/webapps/HUBvivo115/themes/wilma/templates/`
(la webapp es `HUBvivo115`, **no** `ROOT`)

| Plantilla `.ftl` | Endpoint HTTP | Tipo de Entidad Ontológica |
|---|---|---|
| `search.ftl` | `/search` | Búsqueda global (Sin filtro fijo) |
| `search-find-a-supervisor.ftl` | `/find-a-supervisor` | `foaf:Person` + `vlocal:UREntity` |
| `search-find-a-partner.ftl` | `/find-a-partner` | `foaf:Person` + `vlocal:UREntity` |
| `search-find-a-program.ftl` | `/find-a-program` | `vivo:Program` |
| `search-find-a-lab.ftl` | `/find-a-lab` | `vivo:CoreLaboratory` |
| `search-find-a-speaker.ftl` | `/find-a-speaker` | `vivo:presentador` |

> **Nota para Desarrolladores:** Cada plantilla FTL depende de los scripts inyectados al final de la página (ej: `dynamic-filters4.js`). Revisa que los ID de los elementos de UI (como `.js-search-form`) no sean alterados, ya que el JS depende de ellos para funcionar.

### Capa 2: Lógica (Java Servlets)

Ubicación en servidor: `/opt/tomcat/webapps/HUBvivo115/WEB-INF/classes/.../controller/search/`

* **`PagedSearchControllerFaceted`**: Es un único servlet genérico que se "clona" 5 veces en el archivo `web.xml` usando distintos `init-param`. Cambiando su configuración XML puedes definir qué campos Solr solicita o qué plantilla renderiza sin tocar código Java.
* **`UrAutocompleteController`**: Micro-servicio REST que atiende únicamente consultas de tecleo (typeahead) en `/autocompleteUr`. Devuelve arreglos de texto JSON puros.

### Capa 3: Capa de Indexación (Apache Solr 7.4)

El puente entre VIVO y el motor de búsqueda. Los filtros de la UI no funcionan mágicamente: cada uno corresponde estrictamente a un campo en el esquema del core `vivocore` de Solr.

| Nombre de Campo Solr (Schema) | Consumido por el buscador... |
|---|---|
| `facet_expertiseAreas` | Supervisor, Partner |
| `facet_preferredTitle` | Supervisor, Lab |
| `facet_academicDepartment` | Supervisor, Partner, Speaker |
| `facet_academicDepartmentLab` | Lab |
| `facet_researchFocus` | Supervisor, Lab |
| `facet_level` | Supervisor, Program |
| `facet_participationAs` | Partner |
| `facet_modality` | Program |
| `facet_confTopic` | Speaker |

> ⚠️ **REGLA DE ORO:** Si un campo `facet_...` no está definido en `schema.xml` como `facet="true"`, Tomcat arrojará una excepción o el filtro aparecerá vacío.

---

## 🚑 3. Troubleshooting (Guía Rápida de Errores)

Si el sistema falla, sigue estos pasos de diagnóstico antes de tocar código:

### ❌ "No se muestran resultados" en una página find-a-*
1. **Verificar Servlet:** Abre el `web.xml` de VIVO y asegúrate de que el endpoint está registrado y mapeado al `PagedSearchControllerFaceted`.
2. **Verificar Motor:** Abre `http://localhost:8983/solr/vivocore/admin/ping` en el servidor y asegúrate de que Solr esté online (`status: OK`).
3. **Verificar Logs:** Mira las últimas líneas del archivo `/opt/tomcat/logs/catalina.out`. Busca excepciones de `SolrServerException`.

### ❌ "El Autocompletado no responde al escribir"
1. **Probar Endpoint crudo:** Ejecuta `curl "http://localhost:8080/autocompleteUr?term=test"` en la terminal. Debería retornar un JSON válido. Si arroja un HTTP 404, el servlet no arrancó.
2. **Revisar Consola Chrome:** Presiona F12 y revisa si `autocomplete.js` falló al cargar, o si la variable `urls.base` arroja `undefined`.

### ❌ "El sidebar de filtros (facetas) aparece totalmente vacío"
1. **Solr vacío:** Es probable que Solr no tenga datos indexados para esos campos. Ve al panel administrativo de VIVO (Site Admin) y dispara un *Rebuild Search Index*.
2. **Error de Mapeo XML:** Verifica que en el `web.xml`, el parámetro `facet-N-name` coincida *exactamente* con el nombre de la columna en Solr.

### ❌ "El botón de Descarga CSV/XML no aparece"
1. **Carga Incompleta:** El script `searchDownload.js` (v5.9) espera activamente al DOM. Requiere jQuery y qTip (`jquery.qtip.min.js`). Si ves un error de `$ is not defined`, el orden de scripts se rompió en el `.ftl`.

---

## 📜 4. Versionamiento Activo

Para evitar confusiones con archivos residuales heredados de desarrollos previos, estos son los únicos archivos JavaScript que importan:

| Archivo Fuente | Versión Activa | Notas |
|---|---|---|
| `dashboardSearch_hub_v19.js` | **v19** (Premium) | Módulo principal del dashboard (esqueletos, animaciones y **corte por acantilado de nombre**, ver [`05-relevancia-solr.md`](05-relevancia-solr.md)). |
| `dynamic-filters4.js` | **v4** | Motor AJAX para facetas. *Nota: v1, v2 y v3 pueden existir en el servidor; IGNÓRALAS.* |
| `searchDownload.js` | **v5.9** | Inyecta las capacidades de exportación de datos (CSV/XML). |
| `autocomplete.js` | *Stand-alone* | Sin versionamiento estricto. |

---
*Documentación auditada y actualizada: Julio 2026.*
