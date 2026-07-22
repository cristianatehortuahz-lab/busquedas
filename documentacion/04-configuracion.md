# 04 - Configuración de Facetas y Priorización de Búsqueda

Este documento explica cómo añadir un **nuevo filtro (faceta)** a un buscador existente, cómo priorizar las facetas y cómo configurar los pesos de relevancia (*Search Boosting*) en Solr.

---

## 🎯 1. Estrategia de Priorización de Búsqueda (3 Capas)

La priorización de resultados y filtros está organizada en 3 capas alineadas:

### Capa 1: Boosting de Campos en Solr (*Field Boosting*)
Cuando un usuario busca un término en Solr, los campos deben responder con ponderaciones distintas. Esto se configura en `solrconfig.xml` del core `vivocore` (parámetros `qf` - Query Fields) o en el controlador Java `PagedSearchControllerFaceted.java`:

```xml
<!-- Configuración recomendada de Query Fields (qf) en solrconfig.xml -->
<str name="qf">
    nameRaw^10.0
    nameLowercaseSingleValued^5.0
    facet_expertiseAreas^3.0
    facet_researchFocus^2.0
    ALLTEXT^1.0
</str>
```

| Campo | Peso (Boost) | Razón |
|---|---|---|
| `nameRaw` / `nameLowercaseSingleValued` | **^10.0 / ^5.0** | Si coincide el nombre exacto de la persona/programa, DEBE aparecer de primero. |
| `facet_expertiseAreas` | **^3.0** | Coincidencia en área de especialización directa. |
| `facet_researchFocus` | **^2.0** | Coincidencia en foco de investigación. |
| `ALLTEXT` | **^1.0** | Texto general del perfil/biografía (peso base). |

### Capa 2: Ordenamiento por Defecto en la UI (*Sort Default*)
Para que los resultados muestren primero a los investigadores más productivos o relevantes y no sigan un simple orden alfabético A-Z:

- **Supervisor (`/find-a-supervisor`):** Ordena por defecto por `numTutoredTheses|DESC` ("Relevancia" basada en tesis dirigidas).
- **Partner (`/find-a-partner`):** Ordena por defecto por `numPublications|DESC` ("Relevancia" basada en número de publicaciones).
- **Program, Lab, Speaker:** Ordenan por `nameLowercaseSingleValued|ASC` (Alfabético A-Z).

### Capa 3: Prioridad de Facetas en la Barra Lateral (*Facet Ordering*)
En `web.xml`, el orden de los `<init-param>` define el orden de aparición visual de las facetas de arriba a abajo. **Escuelas/Facultades** siempre se posiciona como `facet-1-*` (salvo en Speakers donde `Conference Topic` es más diferenciador).

---

## 🔧 2. Caso Práctico: Añadir Filtro "Sede" al Buscador de Programas

### Paso 1: Configurar el Backend (`web.xml`)
El servlet Java necesita saber que debe solicitar esta nueva faceta a Solr y cómo llamarla en la UI.
Abre tu archivo de configuración de servlets (`web-xml-search-servlets.xml` o directamente el `web.xml` de Tomcat) y localiza el `<servlet>` del programa.

Añade los `init-param` secuenciales para el nuevo filtro:
```xml
<init-param>
    <param-name>facet-3-name</param-name>
    <!-- Nombre EXACTO de la columna en Solr -->
    <param-value>facet_campusLocation</param-value> 
</init-param>
<init-param>
    <param-name>facet-3-label</param-name>
    <!-- Etiqueta pública que verá el usuario en el sidebar -->
    <param-value>Sede Académica</param-value> 
</init-param>
```

### Paso 2: Actualizar el Esquema de Solr (`schema.xml`)
Si `facet_campusLocation` no existe en Solr, Tomcat fallará.
Debes acceder al servidor de Solr, editar `schema.xml` del core `vivocore` y declarar el campo:
```xml
<field name="facet_campusLocation" type="string" indexed="true" stored="true" multiValued="true" />
```
*Tras esto, debes reiniciar Solr y ejecutar un "Rebuild Search Index" desde el admin de VIVO.*

### Paso 3: Habilitar en el Frontend (FreeMarker)
El JavaScript del frontend (`dynamic-filters4.js`) es 100% dinámico. Construye los checkboxes leyendo el JSON que envía Tomcat. No necesitas tocar el JavaScript.

Lo único que debes hacer es abrir `search-find-a-program.ftl` y asegurarte de que el contenedor de facetas esté listo para renderizar bloques dinámicos:
```html
<div class="search-sidebar js-checkbox-facet" id="facet_campusLocation">
    <h4 class="js-facet-title">Sede Académica</h4>
    <!-- El JS inyectará los <input type="checkbox"> aquí -->
</div>
```

---
> 💡 **Tip Arquitectónico:** El frontend de los filtros (`dynamic-filters4.js`) utiliza un enfoque *Data-Driven*. Dibuja e intercepta cualquier elemento HTML que tenga la clase `.js-checkbox-facet`. Mientras respetes esa clase y la estructura del `<input type="checkbox">`, el motor AJAX absorberá tu nueva faceta automáticamente.
