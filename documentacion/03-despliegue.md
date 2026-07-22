# 03 - Despliegue en Servidor

Esta guía detalla cómo actualizar el frontend del Buscador Facetado en el servidor Linux de producción (`srvcbpbvivo` / `10.194.194.96`).

## 1. Conexión al Servidor
Abre **Xshell** (o tu cliente SSH) y conéctate como usuario `admincrai` a `10.194.194.96`.

## 2. Ubicación del Contexto (Tomcat)
El servidor utiliza Tomcat 9. El contexto de la aplicación VIVO (frecuentemente llamado `ROOT` o `HUBvivo115`) se encuentra mapeado en el directorio de migración.

Ruta base recomendada (según tu historial de despliegue):
`cd /home/admincrai/migracion-1.11/vivo11-installer-prod/VIVO/installer/webapp/target/vivo11-origen/`
*(o la ruta activa definida en el `server.xml` de Tomcat).*

## 3. Transferencia de Archivos (Vía XFTP)
Abre **XFTP** y transfiere los archivos modificados desde tu máquina local respetando la estructura de carpetas:

- **JS Core:** Arrastra `dashboardSearch_hub_v19.js` y `searchDownload.js` a la carpeta `/js/` de VIVO.
- **JS Tema:** Arrastra `dynamic-filters4.js` y `autocomplete.js` a `/themes/wilma/js/`.
- **CSS:** Arrastra los `.css` a `/css/` y `/themes/wilma/css/`.
- **FTL:** Arrastra las plantillas `.ftl` a `/themes/wilma/templates/` y la subcarpeta `shortview` a `/templates/freemarker/body/partials/shortview/`.

## 4. Limpieza de Caché (Evitar Vistas Antiguas)
Tomcat y el navegador almacenan copias fuertemente cacheadas del JavaScript y de las plantillas FreeMarker compiladas.
Tras subir los archivos, fuerza a Tomcat a recompilar los `.ftl`:

```bash
# Limpiar carpeta de trabajo de Tomcat
rm -rf /opt/tomcat/work/Catalina/localhost/_/*
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
