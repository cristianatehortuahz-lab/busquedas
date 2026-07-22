/**
 * =============================================================================
 * MODULO DE AUTOCOMPLETADO PARA BUSQUEDA FACETADA - HUB-UR / VIVO
 * =============================================================================
 *
 * Este archivo implementa el sistema de autocompletado (sugerencias en tiempo
 * real) para los campos de busqueda en las paginas de busqueda facetada de VIVO.
 *
 * ARQUITECTURA:
 * - Se define un unico objeto `autocomplete` con metodos que encapsulan toda
 *   la logica de inicializacion, obtencion de sugerencias y manejo de UI.
 * - Las sugerencias se obtienen del endpoint `/autocompleteUr`, un servlet
 *   personalizado de VIVO que responde con JSON.
 * - La interfaz permite navegacion tanto con teclado (flechas, Enter, Tab, Esc)
 *   como con raton, con un sistema sofisticado para evitar conflictos entre
 *   ambos modos de interaccion.
 *
 * DEPENDENCIAS:
 * - Variable global `baseUrl`: definida por la plantilla FreeMarker (FTL) del
 *   servidor. Contiene la URL base de la aplicacion VIVO.
 * - Fetch API nativa del navegador (no usa jQuery ni librerias externas).
 * - Elementos del DOM con clases CSS especificas:
 *     `.js-autocomplete-input` — campos de texto donde el usuario escribe
 *     `.js-autocomplete-hints`  — contenedores donde se renderizan las sugerencias
 *     `.js-submit`              — botones de envio del formulario
 *     `.js-form`                — formulario contenedor
 *     `.js-disabled`            — clase para deshabilitar visualmente el boton
 *
 * FLUJO DE FUNCIONAMIENTO:
 * 1. Al cargar el DOM, se invoca `autocomplete.init()`.
 * 2. `init()` cachea referencias a los elementos del DOM y adjunta los listeners.
 * 3. Cuando el usuario escribe al menos 3 caracteres, se hace una peticion
 *    al endpoint de autocompletado.
 * 4. Las sugerencias se renderizan como enlaces `<a>` dentro del contenedor.
 * 5. El usuario puede seleccionar una sugerencia con clic, Enter o Tab.
 *
 * DECISIONES DE UX:
 * - Minimo 3 caracteres para activar la busqueda (evita consultas muy amplias).
 * - Navegacion con flechas incluye auto-scroll cuando se llega a los bordes.
 * - Al hacer clic fuera del dropdown, este se cierra automaticamente.
 * - Sistema anti-conflicto raton/teclado: al navegar con flechas, el mouseover
 *   se desactiva temporalmente (500ms) para que la posicion del cursor no
 *   sobreescriba la seleccion del teclado.
 *
 * =============================================================================
 */

/**
 * Objeto principal de autocompletado.
 * Contiene toda la logica para buscar, renderizar y gestionar las sugerencias
 * en los campos de busqueda facetada de VIVO.
 */
let autocomplete = {

  /**
   * URL del endpoint de autocompletado.
   * Se construye a partir de la variable global `baseUrl` (inyectada por la
   * plantilla FTL del servidor) concatenada con la ruta del servlet personalizado.
   * Ejemplo resultante: "https://hub-ur.example.com/autocompleteUr"
   *
   * @type {string}
   */
  autocompleteSrc: `${baseUrl}/autocompleteUr`,

  /**
   * Metodo de inicializacion del modulo de autocompletado.
   * Se invoca una sola vez al cargar el DOM. Obtiene las referencias a los
   * elementos del DOM y adjunta todos los event listeners necesarios.
   *
   * @returns {void}
   */
  init: function() {
    // Paso 1: cachear referencias a los elementos del DOM
    this.getObjects()
    // Paso 2: adjuntar todos los listeners de eventos (teclado, raton, etc.)
    this.attachListeners()
  },

  /**
   * Obtiene y almacena referencias a los elementos del DOM necesarios para
   * el funcionamiento del autocompletado.
   *
   * Cachea tres conjuntos de elementos:
   * - textInputs: los campos de texto donde el usuario escribe su busqueda
   * - hintContainers: los contenedores donde se muestran las sugerencias
   * - submitBtns: los botones de envio de los formularios
   *
   * Cada input se asocia por indice con su hintContainer y submitBtn
   * correspondiente (input[0] <-> hintContainer[0] <-> submitBtn[0]).
   *
   * @returns {void}
   */
  getObjects: function() {
    // Convertir a Array para poder usar forEach, map, etc.
    this.textInputs = Array.from(document.querySelectorAll('.js-autocomplete-input'))
    // NodeList de contenedores de sugerencias (uno por cada input)
    this.hintContainers = document.querySelectorAll('.js-autocomplete-hints')
    // NodeList de botones de envio (marcado como posiblemente no usado)
    this.submitBtns = document.querySelectorAll('.js-submit') // not used / remove?
  },


  /**
   * Metodo principal que adjunta todos los event listeners del autocompletado.
   *
   * Configura la navegacion por teclado, el manejo del dropdown de sugerencias,
   * la obtencion asincrona de sugerencias desde el servidor, y la logica de
   * habilitacion/deshabilitacion de inputs y botones.
   *
   * Este metodo define varias funciones internas (closures) que comparten
   * estado a traves de variables del scope exterior, especialmente para
   * gestionar el conflicto entre navegacion por raton y teclado.
   *
   * @returns {void}
   */
  attachListeners: function() {

    /**
     * Bandera que controla si el evento mouseover puede establecer el
     * elemento "hovered" (seleccionado visualmente).
     *
     * PROPOSITO: Cuando el usuario navega con las flechas del teclado,
     * el scroll automatico puede hacer que el cursor del raton quede
     * sobre una sugerencia diferente, lo que provocaria un conflicto
     * visual. Esta bandera se desactiva temporalmente al hacer scroll
     * con teclado para evitar ese comportamiento no deseado.
     *
     * @type {boolean}
     */
    let allowMouseOverToSetHovered = true

    /**
     * Tiempo en milisegundos que debe esperar el mouseover antes de poder
     * establecer la clase "hovered" despues de una navegacion con teclado.
     * Se usa como base para los timeouts de reactivacion del raton.
     *
     * @type {number}
     */
    let timeUntilMouseOverSetsHovered = 500

    /**
     * Navega a traves de las sugerencias del dropdown usando las teclas
     * de flecha (ArrowUp / ArrowDown).
     *
     * Gestiona:
     * - Seleccion inicial (si no hay elemento seleccionado, selecciona el primero)
     * - Movimiento hacia arriba/abajo con actualizacion del valor del input
     * - Auto-scroll del contenedor cuando la seleccion llega a los bordes visibles
     * - Desactivacion temporal del mouseover para evitar conflictos con el teclado
     *
     * @param {KeyboardEvent} e - El evento de teclado (ArrowUp o ArrowDown)
     * @param {HTMLElement} hintContainer - El contenedor DOM de las sugerencias
     * @param {HTMLInputElement} textInput - El campo de texto asociado
     * @returns {void}
     */
    const navThroughHints = (e, hintContainer, textInput) => {

      let hintBox = hintContainer
      // Buscar si ya hay un elemento con la clase 'hovered' (seleccionado actualmente)
      let currentHover = hintBox.querySelector('.hovered');

      // Si no hay ninguno seleccionado, seleccionar el primer elemento de la lista
      if (!currentHover) {
        hintBox.firstElementChild.classList.add('hovered');
        // Actualizar el valor del input con el texto de la sugerencia seleccionada
        textInput.value = hintBox.firstElementChild.textContent
        return
      }

      /**
       * Transfiere la clase 'hovered' de un elemento a otro y actualiza
       * el valor del campo de texto con el contenido de la nueva seleccion.
       *
       * @param {HTMLElement} current - Elemento actualmente seleccionado
       * @param {HTMLElement} switchTo - Elemento que sera el nuevo seleccionado
       */
      let switchHover = (current, switchTo) => {
        current.classList.remove('hovered')
        switchTo.classList.add('hovered')
        // Reflejar la sugerencia seleccionada en el campo de texto
        textInput.value = switchTo.textContent
      }

      // Obtener las dimensiones del elemento seleccionado y del contenedor
      // para determinar si es necesario hacer scroll
      let currentRect = currentHover.getBoundingClientRect();
      let hintBoxRect = hintBox.getBoundingClientRect();

      /**
       * Restaura la bandera que permite al mouseover establecer la clase 'hovered'.
       * Se invoca tras un timeout despues de hacer scroll con teclado.
       */
      let resetAllowMouseOverToSetHovered = () => { allowMouseOverToSetHovered = true }

      /**
       * Hace scroll hacia arriba en el contenedor de sugerencias.
       * Se activa cuando la navegacion con flecha arriba llega al borde
       * superior visible del contenedor.
       *
       * Tambien desactiva temporalmente el mouseover para evitar que el
       * cursor del raton (que no se ha movido) seleccione otra sugerencia
       * al cambiar la posicion del scroll.
       *
       * @param {HTMLElement} hoveredEl - El elemento actualmente seleccionado
       * @param {HTMLElement} parent - El contenedor con scroll
       */
      let scrollUp = (hoveredEl, parent) => {
        // Desplazar hacia arriba la altura del contenedor menos la de un elemento
        parent.scrollTop -= parent.clientHeight - hoveredEl.clientHeight;
        hintBoxScrolledFromArrowKeys = true
        // Desactivar temporalmente el mouseover para prevenir conflictos
        if (allowMouseOverToSetHovered) {
          allowMouseOverToSetHovered = false
          // Reactivar 300ms despues (500 - 200) para dar tiempo al scroll
          setTimeout(resetAllowMouseOverToSetHovered, timeUntilMouseOverSetsHovered - 200)
        }
      }

      /**
       * Hace scroll hacia abajo en el contenedor de sugerencias.
       * Misma logica de desactivacion temporal del mouseover que scrollUp.
       *
       * @param {HTMLElement} hoveredEl - El elemento actualmente seleccionado
       * @param {HTMLElement} parent - El contenedor con scroll
       */
      let scrollDown = (hoveredEl, parent) => {
        // Desplazar hacia abajo la altura del contenedor menos la de un elemento
        parent.scrollTop += parent.clientHeight - hoveredEl.clientHeight;
        // Desactivar temporalmente el mouseover para prevenir conflictos
        if (allowMouseOverToSetHovered) {
          allowMouseOverToSetHovered = false
          setTimeout(resetAllowMouseOverToSetHovered, timeUntilMouseOverSetsHovered - 200)
        }
      }

      // --- Navegacion con flecha ARRIBA ---
      // Solo moverse si existe un hermano anterior (no estamos en el primer elemento)
      if (e.key == "ArrowUp" && currentHover.previousElementSibling) {
        switchHover(currentHover, currentHover.previousElementSibling)
        // Si el elemento anterior esta fuera del area visible superior, hacer scroll
        if (currentRect.top - currentRect.height < hintBoxRect.top) scrollUp(currentHover, hintBox)
        return
      }

      // --- Navegacion con flecha ABAJO ---
      // Si llegamos aqui, la unica tecla posible es ArrowDown
      // Solo moverse si existe un hermano siguiente (no estamos en el ultimo elemento)
      // only e.key possibility left == "ArrowDown"
      if (currentHover.nextElementSibling) {
        switchHover(currentHover, currentHover.nextElementSibling)
        // Si el elemento siguiente esta fuera del area visible inferior, hacer scroll
        if (currentRect.bottom + currentRect.height > hintBoxRect.bottom) scrollDown(currentHover, hintBox)
      }

    }

    /**
     * Habilita un campo de texto (lo hace editable de nuevo).
     * Se usa despues de recibir la respuesta del servidor para que el usuario
     * pueda seguir escribiendo.
     *
     * @param {HTMLInputElement} input - El campo de texto a habilitar
     * @returns {HTMLInputElement} El mismo input (para encadenar llamadas)
     */
    const enableInput = (input) => {
      input.disabled = false
      return input
    }

    /**
     * Deshabilita un campo de texto (lo hace no editable).
     * Se usa mientras se espera la respuesta del servidor para evitar que
     * el usuario escriba durante la peticion y genere consultas duplicadas.
     *
     * @param {HTMLInputElement} input - El campo de texto a deshabilitar
     * @returns {HTMLInputElement} El mismo input (para encadenar llamadas)
     */
    const disableInput = (input) => {
      input.disabled = true
      return input
    }

    /**
     * Configura un listener global de clic para cerrar el dropdown cuando
     * el usuario hace clic fuera de el.
     *
     * COMPORTAMIENTO:
     * - Si el clic es DENTRO del dropdown: se previene la navegacion del
     *   enlace (preventDefault) y se copia el texto de la sugerencia al input.
     * - En AMBOS casos (dentro o fuera): se cierra el dropdown y se remueve
     *   el listener global para no acumular listeners innecesarios.
     *
     * DECISION DE UX: Se usa un listener en `document` porque necesitamos
     * detectar clics en cualquier parte de la pagina. Se remueve despues
     * del primer clic para evitar memory leaks y comportamiento duplicado.
     *
     * @param {HTMLElement} element - El contenedor del dropdown de sugerencias
     * @param {HTMLInputElement} input - El campo de texto asociado
     * @returns {void}
     */
    const hideOnClickOutside = (element, input) => {

      /**
       * Handler del clic en el documento. Determina si el clic fue dentro
       * o fuera del dropdown y actua en consecuencia.
       *
       * @param {MouseEvent} e - El evento de clic
       */
      const outsideClickListener = e => {

        // Si el clic fue DENTRO del dropdown de sugerencias
        if (element.contains(e.target)) {
          // Evitar que el enlace <a> navegue a otra pagina
          e.preventDefault()
          // Copiar el texto de la sugerencia seleccionada al campo de texto
          input.value = e.target.innerHTML
        }

        // Cerrar el dropdown (tanto si el clic fue dentro como fuera)
        destroyHintBox(element, input)
        // Limpiar: remover este listener del documento
        removeClickListener()

      }

      /**
       * Remueve el listener global de clic del documento.
       * Se invoca despues de que el dropdown se cierra para evitar
       * acumular listeners innecesarios.
       */
      const removeClickListener = () => {
        document.removeEventListener('click', outsideClickListener)
      }

      // Adjuntar el listener global al documento
      document.addEventListener('click', outsideClickListener)
    }

    /**
     * Muestra el dropdown de sugerencias y configura el manejo del mouseover.
     *
     * Implementa un sistema complejo para manejar el conflicto entre la
     * navegacion por teclado y el hover del raton:
     *
     * PROBLEMA: Cuando el usuario navega con flechas y el dropdown hace scroll,
     * el cursor del raton queda sobre un elemento diferente, disparando un
     * mouseover no intencional que cambiaria la seleccion.
     *
     * SOLUCION:
     * 1. `allowMouseOverToSetHovered` se desactiva durante el scroll por teclado.
     * 2. Mientras esta desactivada, los mouseover agregan una clase temporal
     *    `js-counter-visual-hover` que contrarresta el hover visual del CSS.
     * 3. La clase 'hovered' solo se re-establece cuando el raton se DETIENE
     *    durante 500ms (indicando uso intencional del raton).
     *
     * @param {HTMLElement} hintContainer - El contenedor DOM de las sugerencias
     * @param {HTMLInputElement} input - El campo de texto asociado
     * @returns {void}
     */
    const erectHintBox = (hintContainer, input) => {
      let hintBox = hintContainer;
      // ID del timeout para detectar cuando el raton se detiene
      let timeoutIdForSettingHoveredClassAtMouseStop = null

      // Hacer visible el dropdown agregando la clase CSS 'visible'
      hintBox.classList.add('visible')
      // reset scrollTop to 0
      // Reiniciar la posicion de scroll al inicio (para que siempre se vea desde arriba)
      hintBox.scrollTop = 0

      // Configurar el manejo del mouseover con prevencion de conflictos
      hintBox.addEventListener('mouseover', e => {

        // Verificar si el objetivo del evento es un enlace <a> directo del dropdown
        const isLinkTarget = (e.target.tagName == "A" && e.target.parentNode == hintBox)
        // Clase CSS que contrarresta el hover visual nativo cuando el raton
        // no deberia estar controlando la seleccion
        const counterVisualHoverClass = 'js-counter-visual-hover'

        // Si el mouseover esta temporalmente desactivado (por scroll de teclado)
        // y el objetivo es un enlace, agregar la clase que contrarresta el hover
        // visual para que no parezca seleccionado
        if (!allowMouseOverToSetHovered && isLinkTarget) {
          e.target.classList.add(counterVisualHoverClass)
          return;
        }

        // Limpiar la clase de contrarrestacion visual si algun elemento la tiene
        let counteredVisualHoverElement = hintBox.querySelector('.' + counterVisualHoverClass)
        if (counteredVisualHoverElement) counteredVisualHoverElement.classList.remove(counterVisualHoverClass)

        // remove hovered class if any element has it
        // Remover la clase 'hovered' del elemento que la tenga actualmente
        // para que solo un elemento este seleccionado a la vez
        let hoveredEl = hintBox.querySelector('.hovered')
        if (hoveredEl) hoveredEl.classList.remove('hovered')

        // set again hovered class if mouse stops moving
        // not just updating input.value because if user continues with up/down arrow keys script needs to know current .hovered
        // Establecer la clase 'hovered' solo cuando el raton se DETIENE.
        // No se actualiza input.value aqui porque si el usuario continua
        // con las flechas, el script necesita saber cual es el .hovered actual.
        clearTimeout(timeoutIdForSettingHoveredClassAtMouseStop)
        const setHoveredAtMouseStop = () => {
          if (isLinkTarget) {
            e.target.classList.add('hovered')
          }
        }
        // Esperar 500ms de inactividad del raton antes de marcar como 'hovered'
        timeoutIdForSettingHoveredClassAtMouseStop = setTimeout(setHoveredAtMouseStop, timeUntilMouseOverSetsHovered)

      })

    }

    /**
     * Oculta el dropdown de sugerencias y devuelve el foco al campo de texto.
     *
     * @param {HTMLElement} hintContainer - El contenedor DOM de las sugerencias
     * @param {HTMLInputElement|null} input - El campo de texto asociado (opcional)
     * @returns {void}
     */
    const destroyHintBox = (hintContainer, input) => {
      // Remover la clase 'visible' para ocultar el dropdown via CSS
      hintContainer.classList.remove('visible')

      // Si se proporciono un input, habilitarlo y enfocar para que el usuario
      // pueda seguir escribiendo inmediatamente
      if (input) enableInput(input).focus()
    }

    /**
     * Obtiene las sugerencias de autocompletado desde el servidor.
     *
     * Realiza una peticion HTTP GET al servlet `/autocompleteUr` con los
     * parametros del termino de busqueda y el tipo de entidad (Person).
     * Deshabilita el input durante la peticion para evitar escritura concurrente.
     *
     * @param {HTMLInputElement} textInput - El campo de texto con el termino a buscar
     * @param {HTMLInputElement} searchBy - El radio button seleccionado que indica
     *   el tipo de filtro de busqueda (ej: 'keyword', 'name', etc.)
     * @returns {Promise<string[]>} Promesa que resuelve con un array de strings
     *   (las etiquetas/labels de las sugerencias)
     */
    const getHints = (textInput, searchBy) => {
      // Deshabilitar el input mientras se espera la respuesta del servidor
      disableInput(textInput)

      // Determinar si el filtro activo es de tipo 'keyword'
      let isKeywordFilter = searchBy.value == 'keyword'
      // Solo agregar el parametro 'field' en la URL si es busqueda por keyword
      let filterInUrl = isKeywordFilter ? `&field=${searchBy.value}` : ''

      // Construir la URL completa con el termino, filtro y tipo de entidad (Person)
      // El tipo se envia codificado como URL (http://xmlns.com/foaf/0.1/Person)
      let url = `${this.autocompleteSrc}?term=${textInput.value}${filterInUrl}&type=http%3A%2F%2Fxmlns.com%2Ffoaf%2F0.1%2FPerson`
      const request = new Request(url)

      // Realizar la peticion fetch y procesar la respuesta JSON
      return fetch(request)
        // Parsear la respuesta como JSON
        .then(response => response.json())
        // Extraer solo las etiquetas (labels) de cada objeto del resultado
        .then(jsonR => jsonR.map(x => x.label))
        .catch(err => {
          // En caso de error, rehabilitar el input para que el usuario pueda reintentar
          enableInput(textInput);
          console.error(err)
        })
    }

    /**
     * Cantidad minima de caracteres que el usuario debe escribir antes de
     * activar la busqueda de sugerencias. Evita consultas demasiado amplias
     * que retornarian demasiados resultados o sobrecargarian el servidor.
     *
     * @type {number}
     */
    const minTextLen = 3

    // =========================================================================
    // CONFIGURACION DE LISTENERS POR CADA CAMPO DE TEXTO
    // =========================================================================
    // Iterar sobre cada campo de texto de autocompletado para adjuntarle
    // sus event listeners individuales. Cada input se asocia por indice
    // con su contenedor de sugerencias correspondiente.
    this.textInputs.forEach((input, idx) => {

      // Obtener el contenedor de sugerencias que corresponde a este input
      let hintBox = this.hintContainers[idx]
      // Bandera para controlar si se debe cerrar el dropdown (no usada actualmente)
      let shouldCloseHintBox = false

      // Buscar el formulario padre que contiene este input
      let form = input.closest('.js-form')
      // Encontrar el boton de envio dentro de ese formulario
      let submitBtn = form.querySelector('.js-submit')
      // Si el boton tiene la clase de deshabilitado, deshabilitarlo efectivamente
      if (submitBtn.classList.contains('js-disabled')) submitBtn.disabled = true;

      // --- LISTENER DE KEYDOWN: manejo de Enter, Tab y Escape ---
      // Se usa keydown (no keyup) porque Tab y Enter necesitan ser capturados
      // antes de que el navegador ejecute su comportamiento por defecto
      // (Tab cambiaria el foco, Enter enviaria el formulario)
      input.addEventListener('keydown', e => { // for tab && enter needed keydown listener

        // Solo procesar Enter, Tab y Escape; dejar pasar todas las demas teclas
        if (!["Enter", "Tab", "Escape"].includes(e.key)) return
        // Prevenir el comportamiento por defecto del navegador
        e.preventDefault();
        // Cerrar el dropdown de sugerencias
        destroyHintBox(hintBox, input);

        // Mover el foco al boton de envio (UX: facilita el envio rapido)
        submitBtn.focus()
        return;
      })

      // --- LISTENER DE KEYUP: busqueda de sugerencias y navegacion ---
      // Se usa keyup para capturar el valor DESPUES de que la tecla se haya
      // procesado (el caracter ya esta en el input)
      input.addEventListener('keyup', function(e) { //maybe should listen to 'change' event if need to cover cases with ctrl+c/ctrl+v value in input

        // --- Manejo del Backspace: si el texto baja de 3 caracteres ---
        // Cerrar el dropdown y deshabilitar el boton de envio
        if (e.key == "Backspace" && input.value.length < minTextLen) {
          destroyHintBox(hintBox, input)
          // Agregar clase visual de deshabilitado
          submitBtn.classList.add('js-disabled')
          // Deshabilitar efectivamente el boton
          submitBtn.disabled = true
        }

        // --- Habilitar boton de envio cuando hay suficientes caracteres ---
        if (input.value.length >= minTextLen) {
          submitBtn.classList.remove('js-disabled')
          submitBtn.disabled = false;
        }

        // Ignorar flechas izquierda/derecha (solo mueven el cursor, no cambian el texto)
        if (["ArrowLeft", "ArrowRight"].includes(e.key)) return

        // Verificar si el dropdown ya esta visible actualmente
        let isVisibleHintBox = hintBox.classList.contains('visible')

        if (isVisibleHintBox) {

          // at up/down arrow give impression of navigation through hints, due to hover effect
          // Si el dropdown esta visible y se presiona flecha arriba/abajo,
          // navegar a traves de las sugerencias en lugar de buscar nuevas
          let isNavKey = ["ArrowDown", "ArrowUp"].includes(e.key)
          if (isNavKey) { navThroughHints(e, hintBox, input); return }
        }


        // Si el texto es menor al minimo, no buscar sugerencias
        if (input.value.length < minTextLen) return

        // Obtener el radio button seleccionado que determina el tipo de busqueda
        // (por nombre, por keyword, etc.)
        let searchFilter = form.querySelector('input[name=querytype]:checked')


        // Array donde se acumulan las sugerencias como HTML
        let hints = []

        /**
         * Convierte un texto de sugerencia en un enlace HTML y lo agrega
         * al array de sugerencias.
         *
         * @param {string} hintText - El texto de la sugerencia
         */
        const hidrateHint = (hintText) => {
          // Crear un enlace <a> con href vacio (se previene navegacion con preventDefault)
          hints.push(`<a href>${hintText}</a>`)
        }

        /**
         * Procesa un array de textos de sugerencias, convirtiendolos todos
         * en enlaces HTML.
         *
         * @param {string[]} hintTextArr - Array de textos de sugerencias
         */
        const hidrateHints = hintTextArr => hintTextArr.forEach(hidrateHint)

        // Realizar la peticion al servidor y procesar la respuesta
        getHints(input, searchFilter)
          .then(hidrateHints)
          .then(() => {
            // Rehabilitar el input y devolver el foco al usuario
            enableInput(input).focus();

            // don't display container if no hints available
            // Verificar si se recibieron sugerencias del servidor
            let hasHints = hints.length > 0;

            // Si no hay sugerencias y el dropdown esta visible, cerrarlo
            if (!hasHints && isVisibleHintBox) { destroyHintBox(hintBox, input); return }
            // Si no hay sugerencias y el dropdown no estaba visible, no hacer nada
            if (!hasHints) return;

            // add hints into container
            // Insertar todas las sugerencias como HTML dentro del contenedor
            hintBox.innerHTML = hints.join("")


            // Si el dropdown ya estaba visible, solo actualizar contenido (ya esta mostrado)
            if (isVisibleHintBox) return;

            // if container is not already visible, make it
            // Si el dropdown no estaba visible, mostrarlo y configurar el mouseover
            erectHintBox(hintBox, input)
            // remove at click on document, but not on hintBox
            // Configurar el cierre al hacer clic fuera del dropdown
            hideOnClickOutside(document.querySelector('.js-autocomplete-hints.visible'), input)
          })


      }.bind(this))

    })

  },


}

/**
 * Punto de entrada: inicializar el autocompletado cuando el DOM este completamente
 * cargado. Se usa DOMContentLoaded en lugar de 'load' para no esperar a que
 * se descarguen imagenes y otros recursos pesados.
 */
 document.addEventListener("DOMContentLoaded", function(){
  autocomplete.init()
})
