/**
 * =============================================================================
 * dynamic-filters4.js — Motor de Filtros Facetados Dinamicos (v4)
 * =============================================================================
 *
 * DESCRIPCION GENERAL:
 *   Este archivo implementa el motor de busqueda facetada dinamica para las
 *   paginas "find-a-*" (buscar supervisor, buscar socio, etc.) del sistema
 *   VIVO/HUB-UR. Permite a los usuarios realizar busquedas en tiempo real
 *   con filtros de facetas (checkboxes), ordenamiento y paginacion, todo
 *   sin recargar la pagina gracias a llamadas AJAX.
 *
 * VERSION: v4
 *
 * DEPENDENCIAS:
 *   - jQuery: Se utiliza para las llamadas AJAX ($.ajax) y para el evento
 *     $(document).ready() que inicializa el modulo al cargar la pagina.
 *   - Variable global `urlBaseForFilterSearch`: Definida por la plantilla
 *     FreeMarker (.ftl) del servidor. Contiene la URL base del endpoint
 *     de busqueda de VIVO (ej: "/vivo/search").
 *
 * PATRON ARQUITECTONICO:
 *   Se emplea un unico objeto literal `dFilter` que encapsula todo el estado
 *   y comportamiento del modulo. Este patron (modulo singleton) evita
 *   contaminar el espacio global y agrupa logicamente:
 *     - `el`: Referencias cacheadas al DOM (formulario, inputs, contenedores).
 *     - Metodos de construccion de datos (`createDataObj`).
 *     - Metodos de escucha de eventos (`attachFormListeners`, `listenPagesBox`).
 *     - Metodos de comunicacion con el servidor (`newSearch` via AJAX).
 *     - Metodos de transformacion de datos (`prepareFacets`).
 *     - Metodos de manipulacion del DOM (`createFacet`, `refreshFacet`,
 *       `refreshResults`, `createPagination`).
 *     - Utilidades (`delay` para debounce, `displayLoader`/`hideLoader`).
 *
 *   El flujo es dirigido por eventos: los cambios en el formulario disparan
 *   una llamada AJAX con debounce de 1000ms, la respuesta del servidor se
 *   procesa para actualizar facetas, resultados y paginacion en el DOM.
 *
 * FLUJO PRINCIPAL:
 *   1. Usuario escribe texto o cambia un filtro en el formulario.
 *   2. `attachFormListeners` detecta el cambio y aplica debounce (1s).
 *   3. `createDataObj` construye el objeto de consulta desde los inputs.
 *   4. `newSearch` envia la consulta AJAX al API de VIVO (?json=1).
 *   5. La respuesta contiene: facetas, individuos (resultados) y links de paginacion.
 *   6. `prepareFacets` normaliza las facetas de la respuesta.
 *   7. `createFacet`/`refreshFacet` actualizan los checkboxes en el DOM.
 *   8. `refreshResults` reemplaza la lista de resultados.
 *   9. `createPagination` reconstruye los enlaces de paginacion.
 *
 * =============================================================================
 */

var dFilter = {

  /**
   * URL base del endpoint de busqueda.
   * Se obtiene de la variable global `urlBaseForFilterSearch` que es inyectada
   * por la plantilla FreeMarker del servidor VIVO.
   */
  urlBase: urlBaseForFilterSearch,

  /**
   * Objeto de consulta AJAX persistente entre llamadas.
   * Se mantiene entre llamadas para que la paginacion pueda reutilizarlo
   * sin tener que reconstruirlo. En llamadas normales (no paginacion),
   * se reconstruye desde cero con `createDataObj`.
   *
   * @type {Object}
   * @property {number} hitsPerPage - Cantidad de resultados por pagina (25 por defecto).
   * @property {number} startIndex  - Indice de inicio para paginacion (0 por defecto).
   */
  ajaxObj: { hitsPerPage: 25, startIndex: 0 }, // to be kept at ajaxCall, in case next call will be from pagination
              // otherwise, the queryObj will be created each time before ajaxCall

  /**
   * Numero inicial de claves en `ajaxObj`.
   * DEBE coincidir siempre con la cantidad de claves definidas arriba (hitsPerPage, startIndex = 2).
   * Se usa para detectar si ya se ha realizado alguna busqueda AJAX previa.
   *
   * @type {number}
   */
  ajaxObjKeysInitialNo: 2, // has to always match keys number of ajaxObj !!

  /**
   * Bandera que indica si ya se realizo la primera busqueda AJAX.
   * Se usa para ocultar el encabezado de resultados en la primera busqueda.
   *
   * @type {boolean|null}
   */
  firstAjaxSearch: null,

  /**
   * Metodo de inicializacion del modulo.
   * Se invoca al cargar la pagina (desde $(document).ready).
   * Registra los listeners del formulario y de la caja de paginacion.
   */
  onLoad: function() {
    // Adjuntar los listeners de eventos al formulario de busqueda
    this.attachFormListeners()
    // Adjuntar el listener de clics en los enlaces de paginacion
    this.listenPagesBox()
  },

  /**
   * Referencias cacheadas a elementos del DOM.
   * Se almacenan al momento de la creacion del objeto para evitar
   * consultas repetidas al DOM, mejorando el rendimiento.
   *
   * @type {Object}
   */
  el: {
    /** Formulario principal de busqueda */
    form: document.querySelector('.js-search-form'),

    /** Campo de texto principal para la consulta de busqueda */
    queryTextInput: document.querySelector('.js-query-text'),

    /**
     * Inputs que estan fuera del formulario pero participan en la busqueda.
     * Actualmente solo contiene el selector de ordenamiento (sort).
     */
    inputsOutOfForm: {
      sort: document.querySelector('.js-search'),
    },

    // we assume ulResultsParent and pagesBoxParent will always be .js-results-container

    /** Contenedor padre de la lista de resultados de busqueda */
    ulResultsParent: document.querySelector('.js-results-container'),

    /** Un elemento <li> de los resultados, usado como plantilla para clonar */
    aLiFromUlResults: document.querySelector('.js-search-hits li'),

    /** Contenedor padre de la caja de paginacion */
    pagesBoxParent: document.querySelector('.js-results-container'),

    /**
     * Un enlace de paginacion (no activo), usado como plantilla para clonar.
     * Se selecciona el segundo enlace para evitar tomar el que tiene la clase js-active-page.
     */
    aPageLink: document.querySelector('.js-search-pages a:nth-of-type(2)'), // to take one without class js-active-page

    /**
     * Contenedor de un checkbox individual dentro de una faceta.
     * Se usa como plantilla para clonar al crear nuevos checkboxes.
     * Puede ser null si no existe ninguna faceta en el HTML inicial.
     */
    checkboxContainer: document.querySelector('.js-checkbox-facet') ? document.querySelector('.js-checkbox-facet input[type=checkbox]').parentNode : null,

    /** Contenedor de una seccion de faceta completa (titulo + checkboxes) */
    checkboxFacetContainer: document.querySelector('.js-checkbox-facet')
  },

  /**
   * Construye el objeto de datos para la consulta AJAX a partir del formulario.
   *
   * Recorre los inputs del formulario (texto, radios, selects, checkboxes)
   * y construye un objeto plano con los pares nombre-valor. Los checkboxes
   * marcados se agrupan como arrays bajo su nombre.
   *
   * @param {HTMLFormElement} form         - El formulario de busqueda.
   * @param {Object}         otherInputs  - Inputs fuera del formulario (ej: {sort: HTMLSelectElement}).
   * @param {boolean}        justSearch   - Si es true, retorna solo los datos basicos
   *                                        (texto + radios), sin facetas ni ordenamiento.
   *                                        Se usa cuando el cambio fue solo en el texto o en un radio.
   * @returns {Object} Objeto con los parametros de la consulta AJAX.
   */
  createDataObj: function(form, otherInputs, justSearch) {
    // Siempre obtener los inputs del formulario, ya que pueden haber cambiado desde la ultima vez
    let dataObj = Object.assign({}, this.ajaxObj)

    // El formulario solo debe tener un input de texto para la consulta AJAX
    // Se agrega al objeto de datos usando su atributo name como clave
    dataObj[this.el.queryTextInput.name] = this.el.queryTextInput.value

    // Recorrer todos los inputs tipo radio del formulario.
    // Se permite que en futuras versiones haya mas radios obligatorios para la busqueda.
    Array.from(form.querySelectorAll('input[type=radio]'))
          .forEach(x => {
            // Ignorar radios no seleccionados
            if (!x.checked) return
            // Agregar el radio seleccionado al objeto de consulta
            dataObj[x.name] = x.value
          })

    // Si solo se necesita la busqueda basica (texto + radios), retornar sin procesar facetas
    if (justSearch) return dataObj;

    // Agregar el valor del selector de ordenamiento (que esta fuera del formulario)
    if (otherInputs.sort) {
      let sort = otherInputs.sort;
      dataObj[sort.name] = sort.value
    }

    // Recorrer todos los selectores (<select>) dentro del formulario.
    // Se asume que un select siempre tiene un valor seleccionado.
    Array.from(form.querySelectorAll('select'))
          .forEach(x => {
            dataObj[x.name] = x.value // we assume select always has value
          })

    // Recorrer todos los checkboxes del formulario (facetas seleccionadas).
    // Los checkboxes marcados se agrupan como arrays bajo su atributo name,
    // porque multiples checkboxes con el mismo name representan una faceta multi-valor.
    Array.from(form.querySelectorAll('input[type=checkbox]'))
          .forEach(x => {

            // Ignorar checkboxes no marcados
            if (!x.checked) return;

            // Inicializar el array si es la primera vez que aparece este name
            if (!dataObj[x.name]) dataObj[x.name] = []
            // Evitar duplicados en el array de valores
            if (dataObj[x.name].includes(x.value)) return
            // Agregar el valor del checkbox al array correspondiente
            dataObj[x.name].push(x.value)
          })



    return dataObj
  },

  /**
   * Registra los listeners de eventos en el formulario de busqueda y en inputs externos.
   *
   * Escucha tres tipos de interacciones del usuario:
   *   1. Cambio en el formulario (change): Para checkboxes, radios y selects.
   *      Ignora inputs de texto (se manejan con keyup).
   *   2. Tecleo en el formulario (keyup): Para el campo de texto de busqueda.
   *      Ignora teclas especiales (Shift, Ctrl, Alt, CapsLock, flechas).
   *   3. Cambio en el selector de ordenamiento (fuera del formulario).
   *
   * Todas las interacciones aplican un debounce de 1000ms para evitar
   * llamadas AJAX excesivas mientras el usuario sigue interactuando.
   */
  attachFormListeners: function() {

    /**
     * Muestra el indicador de carga (overlay + spinners).
     * Activa la clase CSS 'js-display' en el overlay y en los loaders
     * cuyo contenedor padre tiene al menos 200px de alto.
     */
    function displayLoader() {
      // Obtener el overlay de carga y hacerlo visible
      let overlayer = document.getElementById('js-loading-overlayer') // extract this in this.el
      overlayer.classList.add('js-display')

      // Obtener todos los spinners de carga
      let loaders = Array.from(document.getElementsByClassName('js-loader')) // extract this in this.el
      loaders.forEach(x => {
        // Solo mostrar el spinner si su contenedor padre es suficientemente alto (>= 200px)
        // Esto evita mostrar spinners en secciones muy pequenas donde se verian mal
        if (x.parentElement.clientHeight >= 200) x.classList.add('js-display')
      })

    }

    /**
     * Oculta el indicador de carga.
     * Remueve la clase 'js-display' de todos los elementos que la tengan,
     * ocultando tanto el overlay como los spinners.
     */
    function hideLoader() {
      let loaders = Array.from(document.getElementsByClassName('js-display'))
      loaders.forEach(x => x.classList.remove('js-display'))
    }

    // Longitud minima del texto de busqueda para disparar una consulta AJAX
    const minLen = 3;

    // --- LISTENER 1: Evento 'change' en todo el formulario ---
    // Captura cambios en checkboxes, radios y selects (delegacion de eventos).
    this.el.form.addEventListener('change', function(e) {

      // Los inputs de texto se manejan con el evento 'keyup', no con 'change'
      if (e.target.type == 'text') return;

      // No buscar si el texto de consulta es menor que la longitud minima
      if (this.el.form.querySelector('#facets-querytext').value < minLen) return;

      // Aplicar debounce de 1000ms para evitar multiples llamadas AJAX rapidas
      this.delay(function() {

        // Mostrar el indicador de carga mientras se procesa
        displayLoader()

        // Si el cambio fue en un radio, solo enviar datos basicos (justSearch=true).
        // Los radios representan el tipo de busqueda, no facetas adicionales.
        let isJustSearch = e.target.type == 'radio'
        // Construir el objeto de consulta con los valores actuales del formulario
        let ajaxObj = this.createDataObj(this.el.form, this.el.inputsOutOfForm, isJustSearch)
        // Ejecutar la busqueda AJAX
        this.newSearch(ajaxObj)

        // Ocultar el loader despues de 500ms como respaldo visual
        setTimeout(hideLoader, 500)

      }.bind(this), 1000)


    }.bind(this))

    // --- LISTENER 2: Evento 'keyup' en todo el formulario ---
    // Captura el tecleo en el campo de texto de busqueda.
    this.el.form.addEventListener('keyup', function(e) {
      // El evento keyup tambien se dispara al presionar 'Escape' con un select abierto.
      // Solo procesar si el target es un input de texto.
      if (e.target.type != 'text') return

      // No buscar si el texto aun no alcanza la longitud minima
      if (e.target.value.length < minLen) return

      // Aplicar debounce de 1000ms
      this.delay(function() {
        // Lista de teclas que deben ignorarse porque no representan texto nuevo:
        // Shift(16), Ctrl(17), Alt(18), CapsLock(20), Flechas(37-40)
        let ignoredKeys = [16, 17, 18, 20, // shift, ctrl, alt, caps
                      37, 38, 39, 40] // keyboard arrows

        // Si la tecla presionada es una de las ignoradas, no hacer nada
        if (ignoredKeys.includes(e.which)) return;

        // Mostrar indicador de carga
        displayLoader()

        // Para el tecleo, siempre se envia como busqueda basica (justSearch=true)
        // porque el usuario esta escribiendo texto, no cambiando facetas
        let ajaxObj = this.createDataObj(this.el.form, this.el.inputsOutOfForm, true)
        this.newSearch(ajaxObj)
        // Ocultar el loader despues de 500ms
        setTimeout(hideLoader, 500)

      }.bind(this), 1000)

    }.bind(this))

    // --- LISTENER 3: Evento 'change' en el selector de ordenamiento ---
    // Este input esta fuera del formulario, por lo que necesita su propio listener.
    if (this.el.inputsOutOfForm.sort) {

      let sort = this.el.inputsOutOfForm.sort;

      sort.addEventListener('change', e => {

        // No buscar si el texto de consulta es menor que la longitud minima
        if (this.el.queryTextInput.value.length < minLen) return

        // Aplicar debounce de 1000ms
        this.delay(function() {

          // Mostrar indicador de carga
          displayLoader()

          // Para cambios de ordenamiento, se incluyen todos los datos (justSearch=false)
          // porque el ordenamiento afecta a los resultados completos con facetas
          let ajaxObj = this.createDataObj(this.el.form, this.el.inputsOutOfForm, false)
          this.newSearch(ajaxObj)

          // Ocultar el loader despues de 500ms
          setTimeout(hideLoader, 500)

        }.bind(this), 1000)
      })
    }
  },

  /**
   * Utilidad de debounce (antirrebote).
   *
   * Retorna una funcion que retrasa la ejecucion del callback dado.
   * Si se invoca de nuevo antes de que expire el temporizador,
   * el temporizador anterior se cancela y se reinicia.
   * Esto evita que se disparen multiples llamadas AJAX mientras
   * el usuario sigue interactuando con el formulario.
   *
   * Se ejecuta inmediatamente como IIFE (Immediately Invoked Function Expression)
   * para crear el closure que mantiene la variable `timer` persistente.
   *
   * @param {Function} callback - Funcion a ejecutar despues del retardo.
   * @param {number}   ms       - Tiempo de espera en milisegundos.
   */
  delay: function(){
    var timer = 0;
    return function(callback, ms) {
      // Cancelar el temporizador anterior si existe
      clearTimeout(timer);
      // Establecer un nuevo temporizador
      timer = setTimeout(callback, ms)
    }
  }(),


  /**
   * Transforma las facetas de la respuesta del API en una estructura normalizada.
   *
   * La respuesta del API de VIVO tiene una estructura particular para las facetas.
   * Este metodo las convierte a un formato interno mas limpio y consistente,
   * facilitando su uso en `createFacet` y `refreshFacet`.
   *
   * @param {Object} xhrResponse - Respuesta JSON del API de VIVO.
   * @param {Array}  xhrResponse.facets - Array de facetas del API.
   * @returns {Array<Object>} Array de facetas normalizadas con la estructura:
   *   - sectionId {string}:    Identificador unico de la seccion (baseName del API).
   *   - sectionTitle {string}: Titulo visible de la seccion (publicName del API).
   *   - checkboxes {Array}:    Array de objetos checkbox con id, checked, name, value, label.
   */
  prepareFacets: function(xhrResponse) {
    var facets = xhrResponse.facets.map(x => {
          return {
            // Usar baseName como ID unico de la seccion de faceta
            sectionId: x.baseName,
            // Usar publicName como titulo visible para el usuario
            sectionTitle: x.publicName,
            // Transformar cada categoria en un objeto checkbox normalizado
            checkboxes: x.categories.map(
              y => {
                return {
                  // ID unico del checkbox: combinacion de fieldName y id de la categoria
                  id: `${x.fieldName}-${y.id}`,
                  // Estado de seleccion del checkbox
                  checked: y.selected,
                  // Nombre del campo (para agrupar checkboxes de la misma faceta)
                  name: x.fieldName,
                  // Valor que se enviara en la consulta AJAX
                  value: y.label,
                  // Texto visible junto al checkbox (actualmente igual al value)
                  label: y.label // to be explicit that now label is same with input value
                }
              })
          }
        })

    return facets
  },

  /**
   * Elimina del DOM las secciones de facetas que ya no existen en la respuesta del API.
   *
   * Cuando una nueva busqueda retorna menos facetas que las que hay en el DOM,
   * este metodo remueve las sobrantes para mantener la interfaz sincronizada
   * con los datos del servidor.
   *
   * @param {Array<string>} responseFacetIds - Array de IDs de facetas presentes en la respuesta.
   */
  removeNotNeededHtmlFacets: function(responseFacetIds) {
    // Recorrer todas las secciones de faceta existentes en el DOM
    Array.from(document.getElementsByClassName('js-checkbox-facet'))
      .forEach(x => {
          // Si la faceta del DOM esta en la respuesta, conservarla
          if (responseFacetIds.includes(x.id)) return

          // Si no esta en la respuesta, eliminarla del DOM
          document.getElementById(x.id).remove()
    })
  },

  /**
   * Crea una nueva seccion de faceta en el DOM a partir de los datos normalizados.
   *
   * PRECONDICION: La seccion de faceta NO debe existir previamente en el DOM.
   * Si ya existe, usar `refreshFacet` en su lugar.
   *
   * Clona la plantilla de faceta existente, modifica su titulo e ID,
   * y genera los checkboxes correspondientes antes de anexarla al formulario.
   *
   * @param {Object} facet - Objeto de faceta normalizado (de `prepareFacets`).
   * @param {string} facet.sectionId    - ID unico para la seccion.
   * @param {string} facet.sectionTitle - Titulo visible de la seccion.
   * @param {Array}  facet.checkboxes   - Array de datos para generar checkboxes.
   */
  createFacet: function(facet) {

    // ***** EL SIGUIENTE CODIGO ASUME QUE EL DIV DE FACETA NO EXISTE EN EL DOM ****

    // Clonar la plantilla de faceta completa (con titulo y checkboxes de ejemplo)
    let aHtmlFacet = this.el.checkboxFacetContainer.cloneNode(true)
    // Obtener el contenedor de un checkbox individual como plantilla
    let anInputBox = aHtmlFacet.querySelector('input[type=checkbox]').parentNode
    // Obtener el padre donde se insertaran los nuevos checkboxes
    let inputBoxParent = anInputBox.parentNode

    // Eliminar todos los checkboxes de ejemplo de la plantilla clonada
    // para luego reemplazarlos con los checkboxes reales de la faceta
    aHtmlFacet.querySelectorAll('input[type=checkbox]').forEach(x => x.parentNode.remove())

    // Actualizar el titulo de la seccion de faceta con el nuevo titulo
    aHtmlFacet.querySelector('.js-facet-title').textContent = facet.sectionTitle
    // Asignar el ID unico a la seccion de faceta
    aHtmlFacet.id = facet.sectionId
    // En este punto la plantilla clonada ya esta suficientemente modificada
    // para ser considerada una nueva seccion de faceta
    let newHtmlFacet = aHtmlFacet

    // Crear un checkbox por cada elemento en facet.checkboxes,
    // clonando la plantilla y reemplazando los atributos relevantes:
    // htmlFor (del label), id del input, value, name, y texto visible
    facet.checkboxes.forEach(x => {
      // Clonar la plantilla de checkbox individual
      let newInputBox = anInputBox.cloneNode(true)

      // Configurar el atributo 'for' del label para asociarlo con el input
      let label = newInputBox.tagName == 'LABEL' ? newInputBox : newInputBox.querySelector('label')
      label.htmlFor = x.id;

      // Configurar los atributos del input checkbox
      let input = newInputBox.querySelector('input[type=checkbox]')
      input.id = x.id
      input.value = x.value
      input.name = x.name

      // Buscar el nodo de texto dentro del contenedor del checkbox
      // (se asume que hay un solo nodo de texto no vacio que muestra la etiqueta)
      let textNode = Array.from(newInputBox.childNodes).find(x => x.nodeName == '#text' && x.nodeValue.trim())
      // Actualizar el texto visible con la etiqueta de la faceta
      textNode.nodeValue = x.label

      // Agregar el nuevo checkbox al contenedor padre
      inputBoxParent.appendChild(newInputBox)

    })



    // Agregar la nueva seccion de faceta completa al formulario
    this.el.form.appendChild(newHtmlFacet)

  },

  /**
   * Actualiza una seccion de faceta existente en el DOM con datos nuevos del API.
   *
   * PRECONDICION: La seccion de faceta DEBE existir previamente en el DOM.
   * Si no existe, usar `createFacet` en su lugar.
   *
   * Compara los checkboxes existentes en el DOM con los datos nuevos del API:
   *   - Si un checkbox existe en ambos: actualiza su estado (checked/unchecked).
   *   - Si un checkbox existe en el DOM pero no en la respuesta: lo elimina.
   *   - Si un checkbox existe en la respuesta pero no en el DOM: lo crea y agrega.
   *
   * @param {Object} facet - Objeto de faceta normalizado (de `prepareFacets`).
   * @param {string} facet.sectionId  - ID de la seccion existente en el DOM.
   * @param {Array}  facet.checkboxes - Datos actualizados de los checkboxes.
   */
  refreshFacet: function(facet) {

    // ***** EL SIGUIENTE CODIGO ASUME QUE EL DIV DE FACETA EXISTE EN EL DOM ****

    // Obtener la seccion de faceta del DOM por su ID
    let htmlFacetBox = document.getElementById(facet.sectionId)
    // Obtener todos los checkboxes existentes dentro de la seccion (se especifica type para seguridad)
    let existingInputs = htmlFacetBox.querySelectorAll('input[type=checkbox]') // mention type, to make sure
    // Obtener el contenedor padre donde se insertan los checkboxes
    let inputBoxParent = htmlFacetBox.querySelector('input[type=checkbox]').parentNode.parentNode

    /**
     * Crea un nuevo elemento checkbox en el DOM a partir de los datos proporcionados.
     * Clona la plantilla de checkbox almacenada en `this.el.checkboxContainer`,
     * o crea una desde cero si no existe plantilla.
     *
     * @param {Object} inputData - Datos del checkbox (id, value, name, label).
     * @returns {HTMLElement} Elemento DOM del checkbox listo para insertar.
     */
    let createInputBox = function createInputBox(inputData) {
      let checkboxContainer = this.el.checkboxContainer;
      // Si no existe una plantilla de checkbox en el DOM, crear una desde cero
      // Esto puede pasar si la pagina cargo sin ninguna faceta inicial
      if (!checkboxContainer) {
        checkboxContainer = document.createElement('label')
        checkboxContainer.classList.add('search_supervisor-label')

        checkboxContainer.innerHTML = '<input type=checkbox class=search_supervisor-input><div class=search_supervisor-checkbox-placeholder></div>'
      }

      // Clonar la plantilla de checkbox
      let inputBox = checkboxContainer.cloneNode(true)

      // Configurar el label: si el contenedor es un LABEL, usarlo directamente;
      // de lo contrario, buscar un label hijo
      let label = inputBox.nodeName == 'LABEL' ? inputBox
                  : inputBox.querySelector(`label[for=${inputData.id}]`)

      // Asociar el label con el input mediante htmlFor
      label.htmlFor = inputData.id;

      // Buscar el elemento INPUT entre los hijos directos del contenedor
      let input = Array.from(inputBox.children).find(x => x.tagName == `INPUT`)
      // Configurar los atributos del input
      input.id = inputData.id
      input.value = inputData.value
      input.name = inputData.name

      // Buscar el nodo de texto que contiene la etiqueta visible del checkbox.
      // Se asume que hay un unico nodo de texto no vacio que representa el textContent.
      let textNode = Array.from(inputBox.childNodes).find(x => x.nodeName == '#text' && x.nodeValue.trim())
      // Actualizar el texto visible
      textNode.nodeValue = inputData.label

      return inputBox
    }.bind(this)

    /**
     * Filtra los datos de checkboxes para quedarse solo con los que son nuevos.
     * Elimina del array aquellos indices que ya fueron procesados (ya existen en el DOM).
     *
     * @param {Array}  inputsData             - Array completo de datos de checkboxes.
     * @param {Array<number>} inputsDataIdxToFilter - Indices a excluir (ya procesados).
     * @returns {Array|undefined} Array de datos de checkboxes nuevos, o undefined si no hay.
     */
    function filterInputSeeds(inputsData, inputsDataIdxToFilter) {
      // Quedarse solo con los checkboxes cuyos indices NO estan en la lista de excluidos
      let inputSeeds = inputsData.filter((x,idx,arr) => !inputsDataIdxToFilter.includes(idx))

      // Si no hay checkboxes nuevos, retornar undefined
      if (!inputSeeds.length) return

      return inputSeeds;
    }

    /**
     * Actualiza los checkboxes existentes en el DOM comparandolos con los datos nuevos.
     * Maneja tres casos:
     *   1. El checkbox existe en ambos: actualiza su estado checked.
     *   2. El checkbox existe en el DOM pero no en los datos: lo elimina del DOM.
     *   3. (Registra los indices ya procesados para que se creen los nuevos despues).
     *
     * @param {Array} srcArr    - Datos nuevos de checkboxes (facet.checkboxes).
     * @param {NodeList} targetArr - Checkboxes existentes en el DOM.
     * @returns {Array<number>} Indices de `srcArr` que ya fueron procesados.
     */
    function updateInputs(srcArr, targetArr) {
      // Almacenar los indices de facet.checkboxes que ya fueron verificados/actualizados
      let idxCheckboxesToRemove = [];

      // Recorrer cada checkbox existente en el DOM
      // Casos: Alternar atributo checked; registrar indice procesado; Eliminar checkboxes sobrantes
      targetArr.forEach(x => {

        // Buscar en los datos nuevos un checkbox con el mismo ID
        let inputMatch = srcArr.find(y => y.id == x.id)

        if (inputMatch) {
          // Caso 1: El checkbox existe en ambos - sincronizar el estado checked
          if (x.checked != inputMatch.checked) x.checked = inputMatch.checked

          // Registrar el indice como procesado para no crear un duplicado
          idxCheckboxesToRemove.push(facet.checkboxes.indexOf(inputMatch));

        } else { // Caso 2: El checkbox existe en el DOM pero no en la respuesta
          // Eliminarlo del DOM. Se asume que los inputs estan dentro de un label
          // o de un contenedor que puede tener un label hijo.
          x.parentNode.remove();
        }
      })

      return idxCheckboxesToRemove;
    }


    // Paso 1: Actualizar checkboxes existentes y obtener los indices ya procesados
    const idxCheckboxesToRemove = updateInputs(facet.checkboxes, existingInputs)
    // Paso 2: Filtrar para obtener solo los checkboxes que son nuevos (no existian en el DOM)
    const filteredSeeds = filterInputSeeds(facet.checkboxes, idxCheckboxesToRemove)

    // Paso 3: Si hay checkboxes nuevos, crearlos y agregarlos al DOM
    if (filteredSeeds) {
      const newInputBoxes = filteredSeeds.map(createInputBox)
      newInputBoxes.forEach( x => inputBoxParent.appendChild(x) )
    }

  },

  /**
   * Reemplaza la lista de resultados de busqueda en el DOM con los nuevos resultados.
   *
   * Clona el contenedor <ul> sin sus hijos, luego crea un <li> por cada resultado
   * y reemplaza el contenedor antiguo con el nuevo.
   *
   * @param {Array<string>} results - Array de strings HTML, cada uno representa un resultado individual.
   */
  refreshResults: function(results) {
    // Obtener la lista actual de resultados
    let ulResults = document.querySelector('.js-search-hits')
    // Clonar el contenedor sin hijos (cloneNode(false)) para mantener las clases CSS
    let rBox = ulResults.cloneNode(false)

    // Crear un <li> por cada resultado y agregarlo al nuevo contenedor
    results.forEach(x => {
      // Clonar la plantilla de <li> sin hijos
      let liBox = this.el.aLiFromUlResults.cloneNode(false)
      // Insertar el HTML del resultado dentro del <li>
      liBox.innerHTML = x;
      rBox.appendChild(liBox)
    })

    // Reemplazar la lista antigua con la nueva en el DOM
    this.el.ulResultsParent.replaceChild(rBox, ulResults)

  },

  /**
   * Registra el listener de clics en la caja de paginacion.
   *
   * Usa delegacion de eventos: escucha clics en el contenedor de paginacion
   * y filtra solo los clics en enlaces (<a>). Al hacer clic en un enlace
   * de pagina, extrae el startIndex de la URL del enlace y ejecuta
   * una nueva busqueda AJAX con ese indice, sin recargar la pagina.
   *
   * Se llama tanto en la inicializacion como despues de cada actualizacion
   * de paginacion, ya que los elementos DOM son reemplazados.
   */
  listenPagesBox: function() {
    // Obtener el contenedor de enlaces de paginacion
    let pagesBox = document.querySelector('.js-search-pages')
    // Si no existe paginacion, no hacer nada
    if (!pagesBox) return;

    // Identificar la pagina actualmente activa
    let activePage = pagesBox.querySelector('.js-active-page')

    // Escuchar clics en todo el contenedor de paginacion (delegacion de eventos)
    pagesBox.addEventListener('click', function(e) {

      // Prevenir la navegacion por defecto del enlace (evitar recarga de pagina)
      e.preventDefault();

      // Solo procesar clics en elementos <a> (ignorar clics en otros elementos)
      if (e.target.tagName !== 'A') return;
      // Ignorar clics en la pagina activa (ya estamos en esa pagina)
      if (e.target == activePage) return;

      // Verificar si esta es la primera llamada AJAX (antes de cualquier busqueda).
      // Si es asi, construir el objeto de consulta desde el formulario porque
      // ajaxObj solo tiene las claves iniciales (hitsPerPage, startIndex).
      let isBeforeAnyAjaxCall = Object.keys(this.ajaxObj).length == this.ajaxObjKeysInitialNo;
      if (isBeforeAnyAjaxCall) this.ajaxObj = this.createDataObj(this.el.form, this.el.inputsOutOfForm, false)

      // Extraer el startIndex de la URL del enlace de paginacion.
      // La URL tiene el formato "...?startIndex=N", asi que se divide por 'startIndex='
      // y se toma la segunda parte como el nuevo indice de inicio.
      let targetSearch = e.target.search;
      let targetSearchSplitAtStartIndex = targetSearch.split('startIndex=')
      this.ajaxObj.startIndex = Number(targetSearchSplitAtStartIndex[1])

      // Ejecutar la busqueda AJAX con el nuevo indice de inicio
      this.newSearch(this.ajaxObj);

      // Resetear startIndex a 0 para que la proxima busqueda desde el formulario
      // (no desde paginacion) empiece desde el primer resultado
      this.ajaxObj.startIndex = 0;

    }.bind(this))
  },

  /**
   * Crea o reconstruye la caja de paginacion con los enlaces proporcionados.
   *
   * Clona el contenedor de paginacion sin hijos, luego crea un enlace <a>
   * por cada elemento en el array de links. Si un link no tiene URL,
   * se marca como pagina activa (clase js-active-page).
   *
   * @param {Array<Object>} links - Array de objetos de paginacion del API.
   * @param {string} links[].url  - URL del enlace de paginacion (vacio para pagina activa).
   * @param {string} links[].text - Texto visible del enlace (numero de pagina, "anterior", "siguiente").
   */
  createPagination: function(links) {
    // Obtener la caja de paginacion existente
    let pagesBox = document.querySelector('.js-search-pages')

    // Clonar la caja sin hijos, o crear una nueva si no existe
    let newBox = pagesBox ? pagesBox.cloneNode(false) : document.createElement('div').classList.add('searchpages js-search-pages')

    // Asegurarse de que la plantilla de enlace no tenga la clase de pagina activa
    if (this.el.aPageLink.classList.contains('js-active-page')) this.el.aPageLink.remove('js-active-page')

    // Crear un enlace <a> por cada elemento de paginacion
    links.forEach(linkData => {
      // Clonar la plantilla de enlace de paginacion
      let pageLink = this.el.aPageLink.cloneNode(false)
      // Asignar la URL del enlace
      pageLink.href = linkData.url
      // Asignar el texto visible (numero de pagina, "anterior", "siguiente", etc.)
      pageLink.textContent = linkData.text

      // Si el enlace no tiene URL, es la pagina activa (pagina actual)
      if (!linkData.url) pageLink.classList.add('js-active-page')

      // Agregar el enlace al nuevo contenedor de paginacion
      newBox.appendChild(pageLink)
    })

    // Reemplazar la caja de paginacion antigua con la nueva
    this.el.pagesBoxParent.replaceChild(newBox, pagesBox)
  },

  /**
   * Maneja el estado de "sin resultados encontrados".
   *
   * Limpia la paginacion, muestra un mensaje de disculpa en la lista de resultados,
   * elimina todas las facetas del DOM y vacia el campo de texto de busqueda.
   * Se invoca cuando la respuesta del API no contiene facetas ni resultados.
   */
  foundNoResults: function() {
    // Limpiar la caja de paginacion (dejarla vacia)
    let pagesBox = document.querySelector('.js-search-pages');
    if (pagesBox) pagesBox.innerHTML = ""

    // Mostrar un mensaje informativo en la lista de resultados
    let ulResults = document.querySelector('.js-search-hits')
    if (ulResults) ulResults.innerHTML = "<li>We are sorry, no results found for this search </li>"

    // Eliminar todas las secciones de facetas del DOM,
    // ya que no tiene sentido mostrar filtros si no hay resultados
    Array.from(document.querySelectorAll('.js-checkbox-facet')).forEach(x => { if(x) x.remove() } )
    // Limpiar el campo de texto de busqueda
    this.el.queryTextInput.value = ''
  },

  /**
   * Ejecuta una nueva busqueda AJAX al API de VIVO.
   *
   * Envia el objeto de consulta al endpoint de busqueda con el parametro json=1
   * para recibir la respuesta en formato JSON. Al completarse la llamada,
   * procesa la respuesta para actualizar:
   *   - El valor del selector de ordenamiento (sincronizacion con el servidor).
   *   - Las secciones de facetas (crear, actualizar o eliminar segun corresponda).
   *   - La lista de resultados de busqueda.
   *   - Los enlaces de paginacion.
   *
   * En la primera busqueda, oculta el encabezado de resultados estatico
   * para dar paso a los resultados dinamicos.
   *
   * @param {Object} queryObj - Objeto con los parametros de busqueda
   *                            (construido por `createDataObj` o reutilizado de `ajaxObj`).
   */
  newSearch: function(queryObj) {
    // Guardar referencia a `this` para uso dentro del callback de jQuery
    let self = this;

    // En la primera busqueda AJAX, ocultar el encabezado de resultados estatico
    // que fue renderizado por el servidor. Se marca como invisible con CSS.
    if (!this.firstAjaxSearch) {
      this.firstAjaxSearch = true;
      document.querySelector('.searchResultsHeader').classList.add('js-invisible')
    }

    // Realizar la llamada AJAX usando jQuery
    $.ajax({
      // URL del endpoint: URL base + parametro json=1 para respuesta JSON
      // + tipo de ontologia para Laboratory (configuracion especifica de VIVO)
      url: `${self.urlBase}?json=1&type=http%3A%2F%2Fvivoweb.org%2Fontology%2Fcore%23Laboratory`,
      // Parametros de busqueda que se envian como query string
      data: queryObj,

      /**
       * Callback que se ejecuta al completarse la llamada AJAX (exito o error).
       * Procesa la respuesta JSON del servidor y actualiza toda la interfaz.
       *
       * @param {jqXHR}  xhr    - Objeto XMLHttpRequest de jQuery.
       * @param {string} status - Estado de la respuesta ("success", "error", etc.).
       */
      complete: function(xhr, status) {
        // Parsear la respuesta JSON del servidor
        let r = jQuery.parseJSON(xhr.responseText);

        // --- Sincronizar el selector de ordenamiento ---
        // Asegurar que el valor del select de ordenamiento en la plantilla
        // coincida con el valor de ordenamiento de la respuesta del servidor
        if (r.sort) { // make sure template sort value is the same with response sort
          let sort = this.el.inputsOutOfForm.sort
          // Si el valor actual difiere del de la respuesta, actualizarlo
          if (sort.value != r.sort) sort.value = r.sort
        } else sort.value = sort.children[0].value //(r.sort is null))

        // --- Manejar respuesta sin resultados ---
        // Si no hay facetas en la respuesta (o el array esta vacio),
        // asumimos que tampoco hay resultados ni paginacion
        if (!r.facets || r.facets.length == 0) {
          this.foundNoResults() // we assume we can't have facets null, but individuals/pagingLinks available in response
          return
        }

        // --- Procesar facetas ---
        // Normalizar las facetas de la respuesta al formato interno
        let facets = self.prepareFacets(r)

        // Eliminar del DOM cualquier seccion de faceta que ya no esta en la respuesta
        this.removeNotNeededHtmlFacets(facets.map(x => x.sectionId))

        // Actualizar o crear cada faceta segun corresponda
        facets.forEach(facet => {
          // Si la seccion ya existe en el DOM, actualizarla; si no, crearla
          if (document.querySelector(`#${facet.sectionId}`)) this.refreshFacet(facet)
          else this.createFacet(facet)
        })

        // --- Actualizar resultados de busqueda ---
        // Reemplazar la lista de resultados con los nuevos individuos de la respuesta
        if (r.individuals && r.individuals.length) this.refreshResults(r.individuals)

        // --- Actualizar paginacion ---
        // Si no hay enlaces de paginacion, limpiar la caja de paginacion y salir
        if (!r.pagingLinks || !r.pagingLinks.length) {
          let searchPagesBox = document.querySelector('.js-search-pages')
          if (searchPagesBox) searchPagesBox.innerHTML = "";
          return
        }

        // Reconstruir la paginacion con los nuevos enlaces
        this.createPagination(r.pagingLinks)
        // Re-registrar el listener de clics en la nueva paginacion,
        // ya que los elementos DOM fueron reemplazados
        this.listenPagesBox()


      }.bind(this)
    })
  }


}




/**
 * Punto de entrada del modulo.
 * Se ejecuta cuando el DOM esta completamente cargado (jQuery document.ready).
 *
 * Configura jQuery para serializar arrays como parametros repetidos
 * (traditional=true), lo cual es necesario para que los checkboxes
 * con el mismo name se envien correctamente al API de VIVO
 * (ej: facet_field=value1&facet_field=value2 en vez de facet_field[]=value1).
 *
 * Luego inicializa el modulo dFilter llamando a su metodo onLoad.
 */
$(document).ready(function(){
  // Activar serializacion tradicional de jQuery para parametros de array
  $.ajaxSettings.traditional = true;
  // Inicializar el modulo de filtros dinamicos
  dFilter.onLoad();
})
