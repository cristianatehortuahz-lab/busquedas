# 02 · Auditoría: LOCAL vs paquete de PRÁCTICAS (eliminación de IA)

> Fecha: 2026-07-21 · Alcance: sistema de búsquedas del HUB-UR
> Veredicto: **el paquete de prácticas NO debe desplegarse tal cual** — contenía
> componentes de IA que ya fueron retirados del proyecto. La versión limpia y
> vigente del buscador es **la de este repositorio**.

---

## 1. Contexto

El proyecto retiró en su totalidad los componentes de **IA generativa** (chatbot,
buscador IA, backend Python en el puerto 3001, Ollama) del entorno LOCAL y de
STAGING. El buscador facetado es independiente de esa IA y funciona solo con
Tomcat/VIVO + Solr.

Existía un paquete de despliegue para el **servidor de prácticas** (pre-producción)
—carpeta `deploy practicas busqueda/`— que era **anterior** a esa limpieza y
todavía arrastraba la IA. Esta auditoría compara ese paquete contra el código
vigente y documenta la depuración.

---

## 2. Comparativa LOCAL (vigente) ↔ PRÁCTICAS (paquete antiguo)

| Componente | LOCAL / este repo | Paquete de prácticas | Estado |
|---|---|---|---|
| `dashboardSearch_hub_v19.js` | 48 KB, sin IA | 55 KB (jun-17), llama `/api/ai/classify_publication` y emite eventos a `hub-search-ai.js` | ❌ contaminado |
| `hub-search-ai.js` | no existe | 32 KB — `fetch http://<host>:3001/api/chat` | ❌ IA (backend inexistente) |
| `hub-chatbot.js` | no existe | presente | ❌ IA |
| `hub-ai-profile.js` | no existe | presente | ❌ IA |
| `search-pagedResults.ftl` | — | inyecta `hub-search-ai.js` vía `headScripts.add(...)` (línea 10) | ❌ carga IA en cada búsqueda |
| `footer.ftl`, `page-home.ftl`, `individual--foaf-person.ftl`, `individual-custom-identities.ftl` | — | sin referencias a IA | ✅ limpios |
| Tarballs `busquedas_practicas.tar.gz`, `home_practicas.tar.gz` | — | configs de facetas Solr (`searchFacetsConfig.ttl`, `searchTextFacetsConfig.ttl`), `search.ftl`, css | ✅ limpios |

---

## 3. Hallazgos detallados

### H1 · Tres scripts de IA retirados seguían en el paquete
`hub-search-ai.js`, `hub-chatbot.js` y `hub-ai-profile.js`. Ninguno pertenece al
buscador facetado; son el frontend del chatbot/IA generativa ya eliminado.

### H2 · Llamadas a un backend inexistente
`hub-search-ai.js` hace `fetch` a `http://<host>:3001/api/chat` (SSE) y el
`dashboardSearch_hub_v19.js` de prácticas llama a `/api/ai/classify_publication`.
Ese backend Python (`hub_rag_api.py` + Ollama) fue retirado, por lo que en runtime
esas llamadas **fallarían** y podrían degradar la experiencia del buscador.

### H3 · Inyección de IA en la plantilla de resultados
`search-pagedResults.ftl` añade `hub-search-ai.js` a los `headScripts`. Al desplegar,
**toda** página de resultados cargaría el chatbot roto.

### H4 · Divergencia de versiones del dashboard
El `dashboardSearch_hub_v19.js` de prácticas (jun-17) es más nuevo que el de LOCAL
(abr-22) y difiere en ~175 líneas. Además de la IA (H2), trae ajustes menores no-IA
(p. ej. detección de persona por `mailto`). La versión vigente y **documentada por
completo** vive en este repo (`frontend/js/dashboardSearch_hub_v19.js`).

### H5 · Documentación obsoleta (`comunicaciones/`)
La carpeta `comunicaciones/` (sesión de jun-16) describe la arquitectura de IA como
"FUNCIONANDO" (Ollama qwen2.5, `hub_rag_api.py` v10.2, puerto 3001). Es un registro
histórico de la **era IA**; hoy está desactualizada y debe leerse como *legacy*.

### H6 · Test obsoleto con credencial embebida
`test_busquedas.py` prueba la API de IA retirada (`http://localhost:3001/api/chat`)
e incluye una **API key de desarrollo en texto plano**. No aplica al buscador actual;
no se publica en este repo. Recomendación: rotar/olvidar esa key y archivar el test.

---

## 4. Acciones aplicadas

1. **Repositorio `busquedas` (este repo):** consolidada la documentación exhaustiva
   de los 4 módulos JS (JSDoc por función + comentarios por bloque, en español),
   verificando que la **lógica es idéntica** al original (solo se añadieron
   comentarios; escapes unicode normalizados a literales, sin cambio de
   comportamiento). Confirmado: **0 referencias a IA** en todo el repo.

2. **Servidor de prácticas (`srvcbpbvivo`):** eliminación quirúrgica de IA en el FTL
   - **Archivo:** `/opt/tomcat/webapps/HUBvivo115/themes/wilma/templates/individual--foaf-person.ftl`
   - **Backup:** creado antes de cualquier cambio (`.ftl.backup`)
   - **Líneas eliminadas:** 9 (252, 265–271, 273–279, 345, 347)
     ```
     252: <div id="hub-ai-superpowers" aria-label="..."></div>
     265–271: <div id="hub-ai-biography"> + 3 spans (header, icon, badge, text)
     273–279: <div id="hub-ai-coauthor"> + 2 spans (header, badge, body)
     345: <link rel="stylesheet"... hub-ai-profile.css />
     347: <script... hub-ai-profile.js?v=2 ...></script>
     ```
   - **Verificación:** `grep -i "hub-ai\|ollama\|:3001"` retorna vacío ✅
   - **Método:** `sed -i` con patrones específicos (sin riesgo de borrados colaterales)
   - **Resultado:** HTML estructura intacta, sin tags huérfanos

3. **Paquete de prácticas (`deploy practicas busqueda/`):** referencia informativa
   - Contiene copias antiguas de IA (pre-limpieza)
   - NO se modificó (es evidencia de auditoría)
   - Recomendación: regenerar desde este repo limpio

4. **Tarballs:** verificados limpios; se conservan como configuración de facetas.

---

## 5. Recomendaciones

- ✅ **Servidor de prácticas:** IA eliminada correctamente (2026-07-21). No requiere más cambios.
- **Futuros despliegues:** regenerar paquetes desde este repo, no desde `deploy practicas busqueda/`.
- **Documentación legacy:** Marcar `comunicaciones/` como *era IA* (jun-16, Ollama + hub_rag_api.py v10.2).
- **Test obsoleto:** `test_busquedas.py` prueba API inexistente (`:3001`) e incluye key dev embebida → archivar.
- **Verificación pre-deployment:** correr el check del §6 en cualquier nuevo despliegue.

---

## 6. Verificación rápida

```bash
# El paquete/repo no debe tener NINGUNA referencia a IA:
grep -ril "hub-search-ai\|chatbot\|hub-ai\|ollama\|:3001\|/api/chat\|classify_publication" .
# → sin resultados = limpio

# Sintaxis de los módulos JS:
for f in frontend/js/*.js; do node --check "$f" && echo "OK: $f"; done
```
