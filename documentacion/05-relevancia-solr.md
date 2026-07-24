# 🎯 Relevancia de búsqueda: ranking en Solr + corte por nombre

Este documento describe cómo se resuelve la **relevancia** de los resultados del
buscador: qué se muestra, en qué orden, y por qué. Son tres piezas que trabajan
juntas —dos en **Solr** (servidor) y una en el **frontend** (JavaScript)— y hay
que replicar las de Solr en cualquier despliegue nuevo, o el buscador vuelve al
comportamiento antiguo.

---

## 1. El problema

VIVO indexa **todo** el texto de cada individuo (nombre, cargo, facultad, áreas
de interés, **y también los títulos de sus publicaciones y proyectos**) en un
único campo de Solr llamado `ALLTEXT`. Al estar todo fundido en un solo campo,
una misma búsqueda tenía dos comportamientos opuestos y ambos malos:

- **Búsqueda por nombre** — buscar `rios` devolvía ~27 personas, pero solo 3 se
  apellidaban Ríos. Las otras 24 coincidían porque *alguna de sus publicaciones*
  mencionaba «río» (estaba en su `ALLTEXT`).
- **Búsqueda temática** — buscar `matematicas` devolvía matemáticos, pero muchos
  describen sus áreas en inglés («Applied mathematics», «Lie Algebras») o en otra
  forma («matemátic**o**»), así que un filtro de texto literal en español los
  dejaba fuera.

No existe un filtro de texto en el navegador que acierte en los dos casos: la
diferencia entre «tema» y «nombre» es semántica. La solución correcta reparte el
trabajo entre Solr (relevancia y recall) y el frontend (afinado final).

---

## 2. Pieza 1 — Ranking en `solrconfig.xml`

**Archivo:** `vivocore/conf/solrconfig.xml`, handler `/select`, bloque `defaults`.

Se ajustan los pesos del *edismax* para que las coincidencias de **nombre** manden
sobre las de `ALLTEXT` (donde vive el ruido de publicaciones):

```xml
<str name="qf">ALLTEXT^0.5 ALLTEXTUNSTEMMED^0.5 nameText^8.0 nameUnstemmed^8.0 nameStemmed^6.0 nameLowercase^10.0</str>
<str name="pf">nameText^15.0 nameUnstemmed^15.0 ALLTEXT^3.0</str>
<str name="pf2">nameText^10.0 nameUnstemmed^10.0</str>
<str name="tie">0.1</str>
```

- `ALLTEXT^0.5` — sigue aportando *recall* (una búsqueda temática encuentra a la
  persona por su área o departamento), pero puntúa poco.
- `nameText^8.0 … nameLowercase^10.0` — quien se apellida así queda muy por
  encima de quien solo lo menciona de pasada.
- `pf` / `pf2` — premian que los términos aparezcan **juntos y en orden** en el
  nombre.

**Efecto medido:** buscar `rios` da apellidos Ríos con *score* ≈ 56 y hunde el
ruido a ≈ 1 (un acantilado limpio). Es un cambio de **tiempo de consulta**: NO
requiere reindexar.

---

## 3. Pieza 2 — Sinónimos multilingües en `synonyms.txt`

**Archivo:** `vivocore/conf/synonyms.txt` (se usa en el analizador de **consulta**
del tipo `text`, así que tampoco requiere reindexar).

Se añaden mapeos temáticos español↔inglés para que una búsqueda en español
encuentre áreas escritas en inglés:

```text
matematicas,matematica,matematico,mathematics,mathematical
quimica,quimico,chemistry,chemical
fisica,physics,physical
biologia,biology,biological
computacion,informatica,computer science,computing,computacional
ingenieria,engineering
estadistica,statistics,statistical
economia,economics,economic
educacion,education,pedagogia,didactica
psicologia,psychology
sociologia,sociology
filosofia,philosophy
historia,history
linguistica,linguistics,lenguaje,language
```

**Efecto medido:** `matematicas` pasó de 27 a ~36 resultados (ahora encuentra
matemáticos con áreas en inglés).

---

## 4. Pieza 3 — Corte por acantilado de nombre (frontend)

**Archivo:** `frontend/js/dashboardSearch_hub_v19.js`, funciones `titleText()` y
`cutAtNameCliff()`.

VIVO **no expone el *score*** al frontend (su modelo `IndividualSearchResult`
solo tiene `uri`, `name`, `snippet`, `mostSpecificTypes`; exponerlo obligaría a
recompilar el core Java de VIVO). Pero **sí** entrega los resultados en orden de
relevancia, y gracias al ranking de la Pieza 1 las coincidencias de nombre van
siempre arriba. Aprovechando eso, el frontend afina el resultado **sin backend**:

- Si el **primer** resultado (el mejor rankeado) **coincide en su nombre/título**,
  la búsqueda es de **nombre** (`rios`): se conserva la racha inicial que también
  coincide en el nombre y se **corta** en el primero que no (el ruido que Solr ya
  dejó al fondo).
- Si el primer resultado **no** coincide en el nombre, la búsqueda es **temática**
  (`matematicas`, `quimica`: nadie se apellida así): **no se corta nada** y se
  muestran todos los que devolvió VIVO.

La regla se adapta sola a cada búsqueda, sin listas ni umbrales fijos.

---

## 5. Resultado

| Búsqueda | Tipo | Antes | Ahora |
|---|---|---|---|
| `rios` | nombre | 27 (24 de ruido) | **3** — solo apellidos Ríos |
| `matematicas` | tema | 2 (filtro roto) | **27** — todos los matemáticos |
| `quimica` | tema | — | químicos + laboratorios |

---

## 6. Cómo aplicar en un servidor nuevo

1. Editar `vivocore/conf/solrconfig.xml` con el bloque `qf`/`pf`/`pf2`/`tie` de la
   sección 2.
2. Añadir los sinónimos de la sección 3 al final de `vivocore/conf/synonyms.txt`.
3. Recargar el core (sin reindexar):
   ```bash
   curl "http://localhost:8983/solr/admin/cores?action=RELOAD&core=vivocore"
   ```
4. Desplegar `dashboardSearch_hub_v19.js` (ya incluye el corte por acantilado).

> Las piezas de Solr de este repo están en
> [`backend/solr-config/`](../backend/solr-config/) como referencia para copiar.

---
*Documentado: Julio 2026.*
