# Despliegue Maestro — Búsquedas Facetadas

**Mapeo de cada archivo del repositorio a su ruta en el servidor** para el módulo de búsquedas facetadas del HUB-UR.

> **Alcance de este repositorio:** frontend (JS/CSS/FTL) + el fragmento de
> configuración de servlets para `web.xml`. Las **clases Java** del servlet
> (`PagedSearchControllerFaceted`, `UrAutocompleteController`) forman parte del
> build de la webapp `HUBvivo115` y **no se incluyen aquí** — este repo solo las
> **registra** en `web.xml`.

---

> **Sobre las direcciones:** los comandos `curl` y `bash` de esta guía se ejecutan
> **en el servidor**, por eso usan `localhost`. Los pasos de navegador usan
> `<servidor>`, que es la dirección del equipo donde corre Tomcat: en el servidor
> de prácticas, `10.194.194.96` (o `srvcbpbvivo`).

---

## 📍 Ubicaciones

**Contenido del repositorio:**

```
busquedas/
├── backend/
│   └── servlet-config/
│       └── web-xml-search-servlets.xml   (fragmento a integrar en web.xml)
├── frontend/
│   ├── js/
│   │   ├── dashboardSearch_hub_v19.js
│   │   ├── searchDownload.js
│   │   ├── dynamic-filters4.js
│   │   └── autocomplete.js
│   ├── css/
│   │   ├── search-results.css
│   │   ├── resultados_busqueda.css
│   │   └── shortViewSearch.css
│   └── templates/
│       ├── search.ftl
│       ├── search-find-a-supervisor.ftl
│       ├── search-find-a-partner.ftl
│       ├── search-find-a-program.ftl
│       ├── search-find-a-lab.ftl
│       ├── search-find-a-speaker.ftl
│       └── shortview/
│           ├── view-search-default.ftl
│           ├── view-search-organization.ftl
│           └── view-search-program.ftl
└── documentacion/
```

**Rutas en el servidor (`srvcbpbvivo`, Linux):**

```
/opt/tomcat/webapps/HUBvivo115/
├── js/
│   ├── dashboardSearch_hub_v19.js
│   └── searchDownload.js
├── themes/wilma/js/
│   ├── dynamic-filters4.js
│   └── autocomplete.js
├── css/
│   └── search-results.css
├── resultados_busqueda.css               (en la raíz de la webapp)
├── themes/wilma/css/shortView/
│   └── shortViewSearch.css
├── themes/wilma/templates/
│   ├── search.ftl
│   └── search-find-a-*.ftl
├── templates/freemarker/body/partials/shortview/
│   ├── view-search-default.ftl
│   ├── view-search-organization.ftl
│   └── view-search-program.ftl
└── WEB-INF/
    └── web.xml                            (integrar fragmento de servlets)

/opt/solr/server/solr/vivocore/conf/
└── schema.xml                             (campos facet_* indexados)
```

---

## 🔄 Pasos de despliegue

### PASO 1: Registrar las páginas en VIVO (Site Admin)

En VIVO (`root-hub@urosario.edu.co`) → **Administrador del sitio** → **Administración de la página**, crea/verifica:

| Título | URL | Plantilla personalizada |
|---|---|---|
| Buscar Supervisor | `/find-a-supervisor` | `search-find-a-supervisor.ftl` |
| Buscar Partner | `/find-a-partner` | `search-find-a-partner.ftl` |
| Buscar Programa | `/find-a-program` | `search-find-a-program.ftl` |
| Buscar Laboratorio | `/find-a-lab` | `search-find-a-lab.ftl` |
| Buscar Presentador | `/find-a-speaker` | `search-find-a-speaker.ftl` |

### PASO 2: Backup en servidor

```bash
cd /opt/tomcat/webapps/HUBvivo115
tar czf ~/backup_busquedas_$(date +%F_%T).tgz \
  js/dashboardSearch_hub_v19.js js/searchDownload.js \
  themes/wilma/js/dynamic-filters4.js themes/wilma/js/autocomplete.js \
  css/search-results.css resultados_busqueda.css \
  themes/wilma/css/shortView/shortViewSearch.css \
  themes/wilma/templates/search*.ftl \
  templates/freemarker/body/partials/shortview/ \
  WEB-INF/web.xml
```

### PASO 3: Subir JavaScript vía XFTP

| Archivo del repositorio | Ruta en el servidor |
|---|---|
| `frontend/js/dashboardSearch_hub_v19.js` | `/opt/tomcat/webapps/HUBvivo115/js/` |
| `frontend/js/searchDownload.js` | `/opt/tomcat/webapps/HUBvivo115/js/` |
| `frontend/js/dynamic-filters4.js` | `/opt/tomcat/webapps/HUBvivo115/themes/wilma/js/` |
| `frontend/js/autocomplete.js` | `/opt/tomcat/webapps/HUBvivo115/themes/wilma/js/` |

> **Ojo con el duplicado:** en el servidor existe también
> `themes/wilma/js/dashboardSearch_hub_v19.js`, con contenido distinto y
> **sin uso** — las plantillas cargan `js/dashboardSearch_hub_v19.js`. Actualiza
> solo esa; la otra es un residuo.

### PASO 4: Subir CSS vía XFTP

| Archivo del repositorio | Ruta en el servidor |
|---|---|
| `frontend/css/search-results.css` | `/opt/tomcat/webapps/HUBvivo115/css/` |
| `frontend/css/resultados_busqueda.css` | `/opt/tomcat/webapps/HUBvivo115/` (raíz de la webapp) |
| `frontend/css/shortViewSearch.css` | `/opt/tomcat/webapps/HUBvivo115/themes/wilma/css/shortView/` |

### PASO 5: Subir plantillas FTL vía XFTP

| Archivo del repositorio | Ruta en el servidor |
|---|---|
| `frontend/templates/search.ftl` | `/opt/tomcat/webapps/HUBvivo115/themes/wilma/templates/` |
| `frontend/templates/search-find-a-supervisor.ftl` | `/opt/tomcat/webapps/HUBvivo115/themes/wilma/templates/` |
| `frontend/templates/search-find-a-partner.ftl` | `/opt/tomcat/webapps/HUBvivo115/themes/wilma/templates/` |
| `frontend/templates/search-find-a-program.ftl` | `/opt/tomcat/webapps/HUBvivo115/themes/wilma/templates/` |
| `frontend/templates/search-find-a-lab.ftl` | `/opt/tomcat/webapps/HUBvivo115/themes/wilma/templates/` |
| `frontend/templates/search-find-a-speaker.ftl` | `/opt/tomcat/webapps/HUBvivo115/themes/wilma/templates/` |
| `frontend/templates/shortview/view-search-default.ftl` | `/opt/tomcat/webapps/HUBvivo115/templates/freemarker/body/partials/shortview/` |
| `frontend/templates/shortview/view-search-organization.ftl` | `/opt/tomcat/webapps/HUBvivo115/templates/freemarker/body/partials/shortview/` |
| `frontend/templates/shortview/view-search-program.ftl` | `/opt/tomcat/webapps/HUBvivo115/templates/freemarker/body/partials/shortview/` |

### PASO 6: Integrar los servlets en `web.xml` (XShell)

El repo trae `backend/servlet-config/web-xml-search-servlets.xml`, que define:
- `UrAutocompleteController` → `/autocompleteUr`
- 5 instancias de `PagedSearchControllerFaceted` (una por buscador)

```bash
# 1. Ver el fragmento a integrar (desde el clon del repositorio)
cat backend/servlet-config/web-xml-search-servlets.xml

# 2. Editar el web.xml destino
nano /opt/tomcat/webapps/HUBvivo115/WEB-INF/web.xml

# 3. Pegar el contenido de <servlet> y <servlet-mapping> ANTES de </web-app>
```

> **Nota:** las clases `co.edu.urosario.researchhub.controller.search.*` deben existir
> ya compiladas dentro del build de `HUBvivo115`. Este paso solo las **registra**.

### PASO 7: Verificar campos facet_* en Solr (opcional)

Si algún buscador usa facetas nuevas, confirma que estén en el schema:

```bash
grep -E "facet_" /opt/solr/server/solr/vivocore/conf/schema.xml
```

### PASO 8: Permisos

```bash
sudo chmod 644 /opt/tomcat/webapps/HUBvivo115/js/dashboardSearch_hub_v19.js
sudo chmod 644 /opt/tomcat/webapps/HUBvivo115/js/searchDownload.js
sudo chmod 644 /opt/tomcat/webapps/HUBvivo115/themes/wilma/js/dynamic-filters4.js
sudo chmod 644 /opt/tomcat/webapps/HUBvivo115/themes/wilma/js/autocomplete.js
sudo chmod 644 /opt/tomcat/webapps/HUBvivo115/css/search-results.css
sudo chmod 644 /opt/tomcat/webapps/HUBvivo115/resultados_busqueda.css
sudo chmod 644 /opt/tomcat/webapps/HUBvivo115/themes/wilma/css/shortView/shortViewSearch.css
sudo chmod 644 /opt/tomcat/webapps/HUBvivo115/themes/wilma/templates/search*.ftl
sudo chmod 644 /opt/tomcat/webapps/HUBvivo115/templates/freemarker/body/partials/shortview/*.ftl
```

### PASO 9: Reiniciar Tomcat y reindexar Solr

> **Reinicio de Tomcat:** usar siempre `/etc/rc.d/init.d/tomcat stop` seguido de
> `start`. No usar `/opt/tomcat/bin/startup.sh` (arranca sin las variables de
> entorno del sistema y provoca errores de traducción en VIVO) ni confiar en
> `systemctl`: el servicio es SysV y el wrapper puede reportar que está vivo
> cuando en realidad murió.

```bash
sudo /etc/rc.d/init.d/tomcat stop && sleep 5 && sudo /etc/rc.d/init.d/tomcat start
```

Luego en VIVO: **Administrador del sitio** → **Rebuild Search Index**.

---

## ✅ Verificación

```bash
# ¿Archivos en destino?
ls -la /opt/tomcat/webapps/HUBvivo115/js/dashboardSearch_hub_v19.js
ls -la /opt/tomcat/webapps/HUBvivo115/themes/wilma/js/dynamic-filters4.js

# ¿Tomcat sin errores?
grep -i error /opt/tomcat/logs/catalina.out | tail -5
```

### En navegador


1. `http://<servidor>:8080/find-a-supervisor` → buscador con facetas
2. Prueba `/find-a-partner`, `/find-a-program`, `/find-a-lab` y `/find-a-speaker`
3. **F12 → Network** al escribir → requests a `/autocompleteUr?term=…`

---

## 📝 Checklist final

- [ ] 5 páginas registradas en VIVO (Site Admin)
- [ ] Backup hecho
- [ ] 4 JS subidos (2 a `js/`, 2 a `themes/wilma/js/`)
- [ ] 3 CSS subidos (2 a `css/`, 1 a `themes/wilma/css/`)
- [ ] 6 FTL de búsqueda + 3 shortview (`view-search-*`) subidos
- [ ] Fragmento de servlets integrado en `web.xml`
- [ ] Campos `facet_*` verificados en `schema.xml` (si aplica)
- [ ] Permisos 644 aplicados
- [ ] Tomcat reiniciado + Rebuild Search Index
- [ ] Verificación en navegador: 5 buscadores cargan + autocomplete responde
