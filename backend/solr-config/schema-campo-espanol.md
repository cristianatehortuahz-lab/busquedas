# Campo `ALLTEXT_ES` — análisis de español para un corpus bilingüe

Fragmento de referencia para el core `vivocore`. Detalle y motivación en
[`documentacion/05-relevancia-solr.md`](../../documentacion/05-relevancia-solr.md).

**Ruta en el servidor de prácticas:** `/opt/solr/server/solr/vivocore/conf/`

## Problema

El campo principal de búsqueda (`ALLTEXT`, tipo `text`) se analiza con un stemmer
de **inglés**:

```xml
<filter class="solr.SnowballPorterFilterFactory" language="English" protected="protwords.txt"/>
```

Pero el contenido es mayoritariamente **español**. La morfología española queda
fragmentada: formas del mismo concepto se indexan como raíces distintas y
devuelven resultados distintos.

Medido con la API de análisis de Solr:

| Formas del mismo concepto | Stemmer inglés (actual) | Stemmer español |
|---|---|---|
| genética / genético / genéticas | 2 raíces | **1 raíz** |
| matemáticas / matemático / matemática | 2 raíces | **1 raíz** |
| jurídico / jurídica / jurídicas | 2 raíces | **1 raíz** |
| biología / biológico / biológicas | 3 raíces | 2 raíces |

Efecto visible: `genética` devolvía 25 investigadores y `genético` solo 15.

## Por qué NO se cambia el stemmer de `ALLTEXT`

El corpus es **bilingüe**: los investigadores describen sus áreas unas veces en
español ("Modelamiento matemático") y otras en inglés ("Applied mathematics").
Cambiar `ALLTEXT` a análisis español arreglaría el español y rompería el inglés:
sería cambiar un sesgo por el opuesto.

## Solución: indexar el mismo texto dos veces

Se añade un campo con el **mismo contenido** pero analizado en español, y se
consultan ambos. Cada consulta acierta por el campo de su idioma, sin detectar
idioma y sin mantener listas de términos.

```bash
# 1. Campo con análisis de español (el fieldType text_es ya existe en el esquema)
curl -X POST -H 'Content-type:application/json' \
  -d '{"add-field":{"name":"ALLTEXT_ES","type":"text_es","multiValued":true,"indexed":true,"stored":false}}' \
  "http://localhost:8983/solr/vivocore/schema"

# 2. Copiar ALLTEXT hacia el campo nuevo en tiempo de indexación
curl -X POST -H 'Content-type:application/json' \
  -d '{"add-copy-field":{"source":"ALLTEXT","dest":"ALLTEXT_ES"}}' \
  "http://localhost:8983/solr/vivocore/schema"
```

Y se añade a `qf` en el handler `/select` de `solrconfig.xml` (ver
[`select-handler-relevancia.xml`](select-handler-relevancia.xml)):

```xml
<str name="qf">ALLTEXT^0.5 ALLTEXT_ES^0.5 ALLTEXTUNSTEMMED^0.5 nameText^8.0 nameUnstemmed^8.0 nameStemmed^6.0 nameLowercase^10.0</str>
```

## ⚠️ Requiere reindexar

A diferencia del ranking y los sinónimos (que son de tiempo de consulta), este
cambio **sí exige reconstruir el índice**: el campo nuevo se llena al indexar.

1. Recargar el core: `curl "http://localhost:8983/solr/admin/cores?action=RELOAD&core=vivocore"`
2. Entrar a VIVO como administrador → **Site Admin → Rebuild Search Index**
   (el endpoint `/SearchIndex` exige autenticación).

Mientras no se reindexe, `ALLTEXT_ES` queda vacío y **no altera nada**: las
búsquedas siguen funcionando exactamente igual que antes. El cambio es seguro de
desplegar y se activa al reconstruir.

> **Nota:** no se puede reindexar desde Solr releyendo los documentos, aunque
> `ALLTEXT` sea `stored="true"`: `ALLTEXTUNSTEMMED` es `stored="false"` y lo
> escribe VIVO directamente, así que ese atajo perdería datos.

## Después de reindexar

Los sinónimos **morfológicos** dentro del español que hay en
[`synonyms-tematicos.txt`](synonyms-tematicos.txt) (p. ej.
`matematicas,matematica,matematico`) quedan **redundantes**: el stemmer los
unifica para *todas* las palabras del idioma, no solo para las de la lista.

Los mapeos **entre idiomas** (`matematicas↔mathematics`) sí deben conservarse:
ningún stemmer cruza idiomas, y eso es lo único que legítimamente necesita una
lista.
