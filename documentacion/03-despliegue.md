# 03 - Despliegue en Servidor

Esta guía detalla cómo actualizar el frontend del Buscador Facetado en el servidor Linux de producción (`srvcbpbvivo` / `10.194.194.96`).

## 1. Conexión al Servidor
Abre **Xshell** (o tu cliente SSH) y conéctate como usuario `admincrai` a `10.194.194.96`.

## 2. Ubicación del Contexto (Tomcat)

El servidor utiliza Tomcat 9. **La webapp de VIVO es `HUBvivo115`, no `ROOT`.**

```
/opt/tomcat/webapps/HUBvivo115/
```

> ⚠️ Es el mismo nivel donde vive el mapa de coautorías
> (`/opt/tomcat/webapps/HUBvivo115/js/coauthorNetworkViz/`). Copiar archivos a
> `/opt/tomcat/webapps/ROOT/` **no da error**: simplemente no surte efecto, y el
> despliegue parece correcto aunque no lo sea.

## 3. Transferencia de Archivos (Vía XFTP)

Transfiere los archivos desde tu máquina local a estas rutas **absolutas**:

| Archivo | Destino en el servidor |
|---|---|
| `dashboardSearch_hub_v19.js`, `searchDownload.js` | `/opt/tomcat/webapps/HUBvivo115/js/` |
| `dynamic-filters4.js`, `autocomplete.js` | `/opt/tomcat/webapps/HUBvivo115/themes/wilma/js/` |
| CSS del tema | `/opt/tomcat/webapps/HUBvivo115/themes/wilma/css/` |
| CSS globales | `/opt/tomcat/webapps/HUBvivo115/css/` |
| Plantillas `search-find-a-*.ftl` | `/opt/tomcat/webapps/HUBvivo115/themes/wilma/templates/` |
| Subcarpeta `shortview` | `/opt/tomcat/webapps/HUBvivo115/templates/freemarker/body/partials/shortview/` |

## 4. Limpieza de Caché (Evitar Vistas Antiguas)

Tomcat cachea las plantillas FreeMarker compiladas. Tras subir los archivos,
fuerza la recompilación borrando su carpeta de trabajo:

```bash
# Limpia todos los contextos: sirve tanto si VIVO esta mapeado como
# HUBvivo115 como si server.xml lo publica en la raiz (contexto "_")
sudo rm -rf /opt/tomcat/work/Catalina/localhost/*
```

## 5. Reinicio del Servicio (Opcional pero Recomendado)
Si los cambios en `.js` o `.css` no se reflejan, o si editaste el `web.xml`, DEBES reiniciar Tomcat:

```bash
# Dependiendo de tu configuración de permisos:
sudo /etc/rc.d/init.d/tomcat stop && sleep 5 && sudo /etc/rc.d/init.d/tomcat start
# O si usas scripts SysV:
sudo sudo /etc/rc.d/init.d/tomcat stop && sleep 5 && sudo /etc/rc.d/init.d/tomcat start
```

## 6. Validación Post-Despliegue
Abre un navegador en modo incógnito e ingresa a `https://srvcbpbvivo:9090/find-a-supervisor`.
Presiona `F12` > Network (Red). Verifica que `dashboardSearch_hub_v19.js` devuelve un HTTP 200 y no está siendo cargado desde el *disk cache* de la versión anterior.
