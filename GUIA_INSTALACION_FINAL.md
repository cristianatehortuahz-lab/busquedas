# Guía de Despliegue en Producción: Buscador Facetado HUB-UR

Este documento detalla los pasos definitivos para instalar, configurar y desplegar el **Buscador Facetado HUB-UR** en un servidor de Producción VIVO (`10.194.194.96` / `srvcbpbvivo`), incluyendo el mapeo de servlets Java en Tomcat, indexación de campos en Solr 7.4 y procedimientos de verificación post-despliegue.

---

## 1. Creación de los Apartados en el Menú (Site Admin)
Antes de desplegar archivos en el servidor, deben registrarse los accesos en la plataforma VIVO.

**1.1 Verificar / Crear las Páginas en VIVO:**
* Ingresa a VIVO con permisos de administrador (`root-hub@urosario.edu.co`).
* En la barra superior roja, haz clic en **"Administrador del sitio"**.
* En la sección **"Configuración de la plataforma"** (columna derecha), haz clic en **"Administración de la página"**.
* Crea o verifica las siguientes 5 páginas personalizadas:

| Título de la Página | URL Relativa | Plantilla Personalizada |
|---|---|---|
| Buscar Supervisor | `/find-a-supervisor` | `search-find-a-supervisor.ftl` |
| Buscar Partner | `/find-a-partner` | `search-find-a-partner.ftl` |
| Buscar Programa | `/find-a-program` | `search-find-a-program.ftl` |
| Buscar Laboratorio | `/find-a-lab` | `search-find-a-lab.ftl` |
| Buscar Presentador | `/find-a-speaker` | `search-find-a-speaker.ftl` |

---

## 2. Copiar el Frontend (Scripts JS y Estilos CSS)
Toda la lógica de filtrado AJAX y representación gráfica de los buscadores se aloja en el directorio web de Tomcat.

**2.1 Copiar Archivos JavaScript:**
* **Ruta Destino Estricta:** `👉 /opt/tomcat/webapps/HUBvivo115/js/` (para scripts globales) y `👉 /opt/tomcat/webapps/HUBvivo115/themes/wilma/js/` (para scripts del tema).
* **Archivos a transferir:**
  - `dashboardSearch_hub_v19.js` → `HUBvivo115/js/`
  - `searchDownload.js` → `HUBvivo115/js/`
  - `dynamic-filters4.js` → `HUBvivo115/themes/wilma/js/`
  - `autocomplete.js` → `HUBvivo115/themes/wilma/js/`

**2.2 Copiar Estilos CSS:**
* **Ruta Destino Estricta:** `👉 /opt/tomcat/webapps/HUBvivo115/css/` y `👉 /opt/tomcat/webapps/HUBvivo115/themes/wilma/css/`.
* **Archivos a transferir:** `search-results.css`, `shortViewSearch.css`, `resultados_busqueda.css`.

> **⚠️ Permisos en Producción:**
> Tras copiar los archivos, asegura permisos de lectura para Tomcat:
> ```bash
> sudo chown -R root:root /opt/tomcat/webapps/HUBvivo115/js/
> sudo chmod -R 755 /opt/tomcat/webapps/HUBvivo115/js/
> ```

---

## 3. Copiar las Plantillas FTL (Envoltorio FreeMarker)
Copiar las plantillas FreeMarker que estructuran la UI de cada buscador.

* **Archivos a copiar:** `search.ftl`, `search-find-a-*.ftl` y la subcarpeta `shortview/`.
* **Ruta Destino Estricta:**
  `👉 /opt/tomcat/webapps/HUBvivo115/themes/wilma/templates/`
  `👉 /opt/tomcat/webapps/HUBvivo115/templates/freemarker/body/partials/shortview/`

> **⚠️ Permisos en Producción:**
> Asegúrate de que las plantillas tengan permisos de lectura adecuados:
> ```bash
> sudo chmod 644 /opt/tomcat/webapps/HUBvivo115/themes/wilma/templates/search-find-a-*.ftl
> ```

---

## 4. FASE BACKEND: Registro de Servlets en `web.xml`
El buscador facetado requiere registrar las 5 instancias del servlet Java `PagedSearchControllerFaceted` y el micro-servicio REST `/autocompleteUr`.

**4.1. Inyección de Configuración:**
* Copia el bloque de servlets desde `backend/servlet-config/web-xml-search-servlets.xml`.
* Abre el archivo de configuración global de Tomcat:
  `👉 /opt/tomcat/webapps/HUBvivo115/WEB-INF/web.xml`
* Pega el contenido dentro del bloque principal `<web-app> ... </web-app>`.

**4.2. Campos en Solr (`schema.xml`):**
Asegúrate de que los campos `facet_*` (ej: `facet_expertiseAreas`, `facet_academicDepartment`) estén declarados en:
`👉 /opt/solr/server/solr/vivocore/conf/schema.xml`

---

## 5. Solución de Problemas

### 5.1. El sidebar de facetas aparece vacío
**Causa:** Solr no tiene datos indexados para esos campos o los `init-param` en `web.xml` no coinciden con el `schema.xml`.
**Solución:** Ve a VIVO > Administrador del Sitio > Rebuild Search Index.

### 5.2. Los filtros AJAX no responden
**Causa:** Caché guardada del navegador o Tomcat conservando la versión vieja de `dynamic-filters.js`.
**Solución:** Purga la carpeta de trabajo de Tomcat:
```bash
# Limpia todos los contextos: sirve tanto si VIVO esta mapeado como
# HUBvivo115 como si server.xml lo publica en la raiz (contexto "_")
sudo rm -rf /opt/tomcat/work/Catalina/localhost/*
sudo /etc/rc.d/init.d/tomcat stop && sleep 5 && sudo /etc/rc.d/init.d/tomcat start
```

---

## 6. Rutas Críticas del Servidor de Producción

| Componente | Ruta Absoluta |
|---|---|
| **Config Servlets** | `/opt/tomcat/webapps/HUBvivo115/WEB-INF/web.xml` |
| **Solr Schema** | `/opt/solr/server/solr/vivocore/conf/schema.xml` |
| **JS Dashboard** | `/opt/tomcat/webapps/HUBvivo115/js/dashboardSearch_hub_v19.js` |
| **JS Filtros AJAX** | `/opt/tomcat/webapps/HUBvivo115/themes/wilma/js/dynamic-filters4.js` |
| **FTL Buscadores** | `/opt/tomcat/webapps/HUBvivo115/themes/wilma/templates/search-find-a-*.ftl` |
| **Log Tomcat** | `/opt/tomcat/logs/catalina.out` |

---
### FIN. Validación Visual
Accede a `https://[TuSitio]/find-a-supervisor` -> Aplica un filtro de departamento -> Verifica que los contadores suben dinámicamente y la lista se actualiza vía AJAX.
