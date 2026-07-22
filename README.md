# 🔍 Buscador Facetado HUB-UR (VIVO)

![VIVO](https://img.shields.io/badge/VIVO-Compatible-brightgreen.svg)
![Solr](https://img.shields.io/badge/Solr-v7.4-D9411E.svg?logo=apache-solr)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6-F7DF1E.svg?logo=javascript)
![Java](https://img.shields.io/badge/Java-Servlets-blue.svg?logo=java)

Este repositorio contiene la implementación nativa y modular del **Sistema de Búsqueda Facetada Personalizada** para la plataforma VIVO (v1.11+) de la Universidad del Rosario. Extiende la búsqueda nativa de VIVO con 5 buscadores especializados, autocompletado inteligente, un dashboard de resultados altamente interactivo y herramientas de exportación (CSV/XML).

---

## ✨ Características Principales

* **Buscadores Especializados (5-in-1):** Segmentación por perfiles (Supervisor, Partner), programas académicos, laboratorios y presentadores (speakers). Cada uno configurado con facetas (filtros) independientes.
* **Dashboard Premium (v5):** Interfaz renovada con badges animados (*count-up*), tarjetas con animación escalonada (*stagger*), estado de carga mediante *skeleton loaders* y diseño responsivo adaptable.
* **Autocompletado Inteligente:** Sugerencias en tiempo real mediante el endpoint `/autocompleteUr`, soportando navegación fluida por teclado.
* **Filtros Dinámicos AJAX (v4):** Sistema SPA que permite paginar, aplicar múltiples filtros (checkboxes) y ordenar resultados sin recargar la página.
* **Exportación de Datos:** Botón emergente (qTip) para descarga masiva de resultados en formatos CSV y XML (ajustable de 10 a 1000 registros).

---

## 🏗️ Arquitectura Técnica

El módulo está fuertemente estructurado para mantener la base lógica separada de la representación:

1. **Frontend (La Experiencia Visual):**
   * Archivos: `dashboardSearch_hub_v19.js`, `dynamic-filters4.js`, plantillas `.ftl`.
   * Función: Single Page Application (SPA) encargada de la renderización del dashboard, intercepción de formularios de filtros vía AJAX y actualizaciones del DOM en tiempo real. **Totalmente agnóstico al entorno (no quema IPs ni puertos locales)**.
2. **Backend (El Controlador):**
   * Archivos: `PagedSearchControllerFaceted.class`, `UrAutocompleteController.class`.
   * Función: Intercepta las solicitudes HTTP, procesa los parámetros de facetas, formula consultas complejas y se comunica con el motor de búsqueda.
3. **Motor de Búsqueda (Solr 7.4):**
   * Core: `vivocore` con campos fuertemente tipados en `schema.xml` (ej: `facet_expertiseAreas`, `facet_academicDepartment`).
   * Función: Ejecuta las consultas vectoriales, devuelve los documentos (hits) y calcula los conteos matemáticos de cada faceta (Facet Counts) en milisegundos.

---

## 📂 Estructura del Repositorio

```text
busquedas-facetadas-hub-ur/      ← Raíz del repositorio
├── frontend/                    ← Archivos estáticos y plantillas UI
│   ├── js/                      
│   │   ├── dashboardSearch_hub_v19.js   ← Lógica del Dashboard global (v5)
│   │   ├── dynamic-filters4.js          ← Motor de filtros AJAX por categoría (v4)
│   │   ├── autocomplete.js              ← Sugerencias en barra de búsqueda
│   │   └── searchDownload.js            ← Popup de exportación (CSV/XML)
│   ├── css/                     ← Hojas de estilo modulares
│   │   ├── search-results.css           ← Estructura lista de resultados
│   │   ├── shortViewSearch.css          ← Tarjetas de vista resumida (Cards)
│   │   └── resultados_busqueda.css      ← Tematización general
│   └── templates/               ← Plantillas FreeMarker (VIVO)
│       ├── search.ftl                   ← Vista principal de búsqueda global
│       ├── search-find-a-*.ftl          ← Plantillas individuales por buscador
│       └── shortview/                   ← Fragmentos FTL de tarjetas
├── backend/                     ← Código del servidor (Referencia)
│   ├── servlet-config/
│   │   └── web-xml-search-servlets.xml  ← Configuración de inyección en web.xml
│   └── controller/search/               ← Ubicación de clases compiladas
├── GUIA_INSTALACION_FINAL.md    ← Manual paso a paso de despliegue
├── README.md                    ← Este archivo
└── documentacion/               ← 📚 Documentación ampliada (ver abajo)
```

---

## 🚀 Despliegue en Servidor

Esta instalación requiere permisos de Consola (SSH) en el servidor Tomcat/VIVO y permisos de Administrador de Sitio dentro de VIVO (Site Admin).

Para conocer las instrucciones paso a paso, revisión de rutas del servidor, mapeo de plantillas FTL, setup del web.xml y procedimientos de resolución de problemas, consulta el manual detallado de instalación:

👉 **[CONSULTAR LA GUÍA DE INSTALACIÓN FINAL](GUIA_INSTALACION_FINAL.md)**

---

## 📚 Documentación

La carpeta [`documentacion/`](documentacion/) reúne la documentación ampliada del buscador: cómo funciona por dentro, cómo desplegarlo y qué configurar en cada ambiente.

| Documento | Para qué |
|---|---|
| [`documentacion/README.md`](documentacion/README.md) | **Empieza aquí:** Rutas críticas, esquema de datos y Troubleshooting paso a paso |
| [`documentacion/01-arquitectura.md`](documentacion/01-arquitectura.md) | Arquitectura de 3 capas en detalle (SPA v5 → Java Servlets → Solr 7.4) |
| [`documentacion/03-despliegue.md`](documentacion/03-despliegue.md) | Guía paso a paso de despliegue en servidor Linux y limpieza de caché |
| [`documentacion/04-configuracion.md`](documentacion/04-configuracion.md) | Guía para agregar nuevas facetas (Solr `schema.xml` + Tomcat `web.xml`) |

> La guía de arriba (`GUIA_INSTALACION_FINAL.md`) es el manual de instalación en producción; `documentacion/` la complementa con el "por qué" y el detalle técnico.

---

## ⚠️ Notas Importantes (v5)

* **Clases Java Compiladas:** Este repositorio está orientado al **Frontend** y a la **Configuración XML**. Las clases de backend (`PagedSearchControllerFaceted.class`, etc.) ya se encuentran compiladas directamente en el servidor. 
* **Dependencia de Solr:** El funcionamiento de las facetas depende estrictamente de que los campos `facet_*` existan en el `schema.xml` de Solr. Si se añade un filtro nuevo, obligatoriamente hay que modificar el esquema de Solr e invocar una reindexación.
* **Inyección de Dependencias VIVO:** Todo archivo JavaScript espera la existencia global del objeto `urls` (ej. `urls.base`) o constantes inyectadas vía FTL (`urlBaseForFilterSearch`).

---

## 🤝 Mantenimiento
Desarrollado para la **Universidad del Rosario**.  
Tecnologías núcleo: JavaScript (ES6), FreeMarker (`.ftl`), Java Servlets, Apache Solr 7.4 (SolrJ), VIVO framework.
