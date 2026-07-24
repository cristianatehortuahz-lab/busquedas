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

**Archivo:** `frontend/js/dashboardSearch_hub_v19.js`, funciones `titleText()`,
`tituloCoincide()`, `rachaDeCoincidencias()` y `esNombreDePersona()`.

VIVO **no expone el *score*** al frontend (su modelo `IndividualSearchResult`
solo tiene `uri`, `name`, `snippet`, `mostSpecificTypes`; exponerlo obligaría a
recompilar el core Java de VIVO). Pero **sí** entrega los resultados en orden de
relevancia, y gracias al ranking de la Pieza 1 las coincidencias de nombre van
siempre arriba, separadas del ruido por un acantilado de puntaje. Aprovechando
eso, el frontend afina el resultado **sin tocar el backend**.

### 4.1 La decisión es GLOBAL, y la toma la sección de investigadores

La sección de **Investigadores** carga primero (ver `ORDER` en `init`) y clasifica
la consulta para **todas** las secciones:

- Si su mejor resultado **coincide en el nombre**, la consulta es un **nombre de
  persona** (`rios`). Entonces **todas** las secciones conservan solo su racha
  inicial de coincidencias por título; las que no tengan ninguna quedan vacías y
  **se ocultan solas**.
- Si **no** coincide, la consulta es **temática** (`matematicas`, `quimica`) y
  **no se corta nada** en ninguna sección.

### 4.2 Por qué solo se mira el nombre de PERSONA

Es la parte contraintuitiva y el motivo de que la regla no sea "si alguna sección
coincide por título". Un **tema** aparece de forma natural en el nombre de las
entidades temáticas: buscar `quimica` coincide con el título del *"Laboratorio de
Investigación en Bio**química**"*. Un **apellido**, en cambio, no aparece jamás en
el nombre de una organización: *"Ríos"* nunca estará en *"Facultad de
Jurisprudencia"*.

Si se aceptara la coincidencia de cualquier sección, `quimica` se clasificaría
como nombre (por el laboratorio) y **se borraría a los químicos**, que coinciden
por sus áreas de interés y no por su apellido. El nombre de persona es la única
señal fiable.

### 4.3 Coincidencia en inicio de palabra

`tituloCoincide()` exige que el término empiece una palabra, no que aparezca en
cualquier posición. Sin esto, `rios` coincidía dentro de "planeta**rios**" y colaba
una publicación titulada *"…los límites planetarios"* en una búsqueda del apellido
Ríos. Exigir inicio de palabra descarta esa coincidencia y sigue permitiendo
escribir solo el principio (`mate` encuentra "matemáticas").

---

## 5. Resultado

Verificado en vivo sobre el entorno local:

| Búsqueda | Clasificación | Investigadores | Organizaciones | Publicaciones |
|---|---|---|---|---|
| `rios` | nombre | **4** — solo apellidos Ríos | oculta | oculta |
| `prieto rios` | nombre | **1** — Prieto Ríos | oculta | oculta |
| `matematicas` | temática | 30 matemáticos | 13 (incl. depto. de Matemáticas) | 30 |
| `quimica` | temática | 19 químicos | 2 (incl. lab. de Bioquímica) | 30 |
| `jurisprudencia` | temática | 30 | 11 (incl. Facultad) | 30 |

Antes de estos cambios, `rios` mostraba 27 investigadores (24 de ruido) más
organizaciones que solo aparecían "por rebote" —la *Facultad de Jurisprudencia*
salía porque uno de sus miembros se apellida Ríos—, y `matematicas` mostraba solo
2 investigadores.

### Limitaciones conocidas

- La clasificación depende de que la sección de Investigadores tenga resultados.
  Si una búsqueda por nombre no devuelve ninguna persona, no se clasifica como
  nombre y no se corta nada (degrada al comportamiento anterior, sin romperse).
- Un apellido que además sea una palabra temática (p. ej. *León*, *Castillo*) se
  tratará como nombre. Es el comportamiento razonable: Solr ya rankea primero las
  coincidencias de nombre.
- La separación perfecta entre identidad y publicaciones exigiría cambiar **qué
  mete VIVO en `ALLTEXT` al indexar** (lado Java/RDF). Todo lo aquí descrito
  trabaja sobre el índice tal como VIVO lo construye hoy.

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
