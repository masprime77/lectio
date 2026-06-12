# Lectio — Checklist de pruebas por prompt

Marca cada casilla al verificarla. Convenciones:

- **[CI]** = comprobación automática/terminal (debería pasar antes de hacer merge).
- **[M]** = prueba manual en dispositivo/emulador (móvil) o en la app (desktop).
- **(móvil)** / **(desktop)** indica dónde se prueba.
- Regla transversal que aplica a *todos* los prompts de datos: el **JSON del semestre debe
  seguir siendo idéntico** entre móvil y desktop. Cuando un prompt lo menciona, hay un paso
  de round-trip para confirmarlo.

Comandos base (raíz del repo):

```bash
npm test                                  # Vitest de @lectio/core
npm run typecheck --workspace @lectio/mobile   # tsc --noEmit del móvil
```

---

## Comprobaciones globales (correr tras CADA prompt)

- [ ] **[CI]** `npm test` pasa y los umbrales de cobertura (líneas/funciones ≥ 70) se mantienen.
- [ ] **[CI]** `npm run typecheck --workspace @lectio/mobile` termina en 0.
- [ ] **[CI]** `git diff --stat` no muestra cambios en `packages/desktop/**` (salvo que el prompt lo indique).
- [ ] **[CI]** No se añadieron dependencias nuevas, salvo las que el prompt autoriza explícitamente.
- [ ] **[CI]** El último commit añade un resumen a `docs/RELEASE_NOTES.md` bajo `## Unreleased`.
- [ ] **[CI]** Si el prompt marca un ítem en `docs/PENDING_FEATURES.md`, la casilla quedó marcada.
- [ ] **[CI]** Commits en estilo Conventional Commits, uno por concern, sin commits vacíos.

---

## Serie de paridad con desktop

### 01 — Core: breakdown + sort + setItemStatus (`01-core-breakdown-sort`)

- [X] **[CI]** `breakdown.test.js`: curso mixto da done/total correcto por tipo; curso vacío → `{done:0,total:0}`.
- [X] **[CI]** `courseBreakdown` en studyMode cuenta solo `*-studied`; un ghost (`__deleted__` + `_ghostSection:'done'`) cuenta como done en modo normal pero **no** en studyMode.
- [X] **[CI]** `sort.test.js`: cada valor de `SORT_ORDER`; progress-asc/desc por `courseProgress`; alpha-asc/desc por nombre; week-asc/desc caen a alfabético A→Z.
- [X] **[CI]** `sortedCourses` **no muta** el array de entrada (otra referencia, orden original preservado).
- [X] **[CI]** `setItemStatus` asigna el tag, limpia `_ghostSection`, devuelve `null` si id desconocido.
- [X] **[CI]** El wrapper dual-mode de `planner-core.js` sigue intacto (`require()` y global de browser funcionan).

### 02 — Prefs locales + reabrir último semestre (`02-mobile-prefs-last-semester`)

- [X] **[M]** (móvil) Abrir semestre A, forzar cierre, relanzar → la app aterriza en A.
- [X] **[M]** (móvil) Volver a la lista, entrar a B, relanzar → aterriza en B.
- [X] **[M]** (móvil) Borrar el último semestre abierto → al relanzar muestra la lista sin crash.
- [X] **[M]** (móvil) El auto-abrir ocurre **una sola vez** por lanzamiento (no re-salta al volver a la lista).
- [X] **[M]** (móvil) No auto-abre si estás en modo edición de la lista.
- [X] **[M]** (móvil) El JSON y las filas de Supabase no cambian (las prefs viven solo en AsyncStorage).

### 03 — Entrada de fecha por calendario (`03-mobile-date-picker`)

- [X] **[CI]** Exactamente **una** dependencia nueva: `@react-native-community/datetimepicker`, fijada por `expo install` a la versión de SDK 56.
- [X] **[M]** (móvil) Crear un semestre con el calendario escribe `startDate` como `YYYY-MM-DD` idéntico al del desktop.
- [X] **[M]** (móvil) Fecha de tarea fijada con el calendario y luego limpiada hace round-trip a `''`.
- [X] **[M]** (móvil) Los valores se muestran correctos al reabrir el formulario.
- [X] **[M]** (móvil) **No** hay desfase de un día en tu zona horaria (se usa `toYMD`, no `toISOString`).
- [X] **[M]** (móvil) Abrir un semestre exportado del desktop (o el seed) muestra las fechas sin cambios.

### 04 — Barra de arrastre en los modales del "+" (`04-modal-grabber`)

- [X] **[M]** (móvil) Al tocar "+" en las tres pantallas aparece la barra (grabber) centrada arriba del sheet.
- [X] **[M]** (móvil) En iOS el sheet sigue arrastrándose para cerrar.
- [X] **[M]** (móvil) En Android la barra se muestra y el formulario funciona normal.

### 05a — Editor de tags por semestre (`05a-mobile-tags-editor`)

- [X] **[CI]** Las declaraciones de `addTag/editTag/deleteTag/reorderTags/isProtectedTag` están en `lectio-core.d.ts`.
- [X] **[CI]** `planner-core.js` **no** se modificó (el modelo de tags ya estaba completo).
- [X] **[M]** (móvil) Abrir "Tags" desde un semestre → secciones **Pending** y **Done** por tipo (Readings/Tasks).
- [X] **[M]** (móvil) Agregar un tag custom de lectura en "Done" → aparece y **cuenta** para el progreso de ítems con ese tag.
- [X] **[M]** (móvil) Renombrar y recolorear un tag custom.
- [X] **[M]** (móvil) Borrar un tag custom → los ítems que lo llevaban se vuelven **ghosts** pero el progreso se mantiene estable.
- [X] **[M]** (móvil) Tags **protegidos** (pending/studied): se pueden recolorear pero **no** renombrar/borrar/reordenar.
- [X] **[M]** (móvil/desktop) Round-trip: reabrir el semestre en desktop (o inspeccionar el JSON) → `readingTags`/`taskTags` coinciden exactamente con el esquema del desktop.

### 05b — Menú de selección de tag por ítem (`05b-mobile-tag-pick-menu`)

- [ ] **[CI]** Sin dependencias nuevas (usa `<Modal>` de RN).
- [ ] **[M]** (móvil) Tocar un ítem abre el sheet con tags **agrupados Pending/Done**, con punto de color y nombre, y el tag actual marcado como activo.
- [ ] **[M]** (móvil) Elegir un tag actualiza el punto/nombre y el % de progreso.
- [ ] **[M]** (móvil/desktop) El `status` escrito coincide con el del desktop para la misma elección.
- [ ] **[M]** (móvil) Long-press sigue permitiendo editar/borrar; el swipe y el batch-edit siguen funcionando.

### 06 — Study Mode (`06-mobile-study-mode`)

- [ ] **[CI]** Sin dependencias nuevas; core intacto.
- [ ] **[M]** (móvil) Activar Study Mode → las barras de la lista y el % del detalle bajan a contar **solo** ítems Studied.
- [ ] **[M]** (móvil) Desactivar → los números vuelven.
- [ ] **[M]** (móvil) El ajuste **sobrevive** a forzar cierre y relanzar.
- [ ] **[M]** (móvil/desktop) Alternar Study Mode **no** cambia ningún tag ni el JSON (exportar antes/después → idéntico).

### 07 — Controles de ordenación (`07-mobile-sort`)

- [ ] **[M]** (móvil) Cada orden reordena la lista de cursos igual que el desktop.
- [ ] **[M]** (móvil) Los órdenes por progreso respetan Study Mode cuando está activo.
- [ ] **[M]** (móvil) La elección **persiste** entre relanzamientos.
- [ ] **[M]** (móvil/desktop) Ordenar **no** modifica el JSON (exportar antes/después → idéntico).
- [ ] **[M]** (móvil) `week-asc/desc` caen a alfabético para el orden de cursos (no hay vista semanal en móvil aún).
- [ ] **[CI]** `PENDING_FEATURES.md`: Sort marcado, **Focus mode** sigue sin marcar.

### 08 — Breakdown readings vs tasks (`08-mobile-breakdown`)

- [ ] **[M]** (móvil) Activar "Breakdown" muestra mini-barras de Readings y Tasks con done/total correctos por curso.
- [ ] **[M]** (móvil/desktop) Los números coinciden con el panel del desktop para el mismo semestre.
- [ ] **[M]** (móvil) Study Mode (cuando está activo) reduce los conteos del breakdown a ítems Studied.
- [ ] **[M]** (móvil) El toggle es por-pantalla y la vista por defecto sigue siendo la lista limpia.

### 09 — Settings (tuerca) con Profile (`09-mobile-settings`)

- [ ] **[M]** (móvil) El header de Semestres muestra una **tuerca** en vez de "Profile".
- [ ] **[M]** (móvil) Tocar la tuerca abre **Settings**.
- [ ] **[M]** (móvil) La fila **Profile** abre la pantalla de cuenta y el **sign-out** sigue funcionando.
- [ ] **[M]** (móvil) (Confirmar decisión del PR) la fila de Feedback apunta a `/feedback` (la pantalla llega en el prompt 10).

### 10 — Feedback in-app (endpoint de Vercel) (`10-mobile-feedback`)

- [ ] **[CI]** Sin dependencias nuevas (`expo-constants` ya estaba).
- [ ] **[M]** (móvil, con red) Enviar un **Bug** y un **Feature** → aparece un issue en `masprime77/lectio` con la etiqueta correcta y el pie "Lectio v\<version\>", igual que desde el desktop.
- [ ] **[M]** (móvil) Validación de campos requeridos (título y cuerpo) funciona.
- [ ] **[M]** (móvil) La ruta de error muestra el mensaje sin crash.

### 11 — Tutorial / onboarding (`11-mobile-tutorial`)

- [ ] **[M]** (móvil) Instalación nueva (o tras limpiar la pref `tutorialSeen`) muestra el tour **una vez** tras el sign-in.
- [ ] **[M]** (móvil) Completar o saltar pone `seen=true` y no reaparece en el siguiente lanzamiento.
- [ ] **[M]** (móvil) Settings → **"Start tutorial"** lo reproduce a demanda.
- [ ] **[M]** (móvil) El tour **nunca** aparece sobre la pantalla de sign-in.
- [ ] **[M]** (móvil) Los botones Back (oculto en el primer paso), Skip y Next/Done y el contador funcionan.

### 12a — Core: helpers de envelope import/export (`12a-core-import-export`)

- [ ] **[CI]** `lectio-file.test.js` pasa: `build*` produce el envelope exacto (`_lectioType`/`_version` + proyección); el export de curso descarta tags y campos extra de ítems.
- [ ] **[CI]** Round-trip `buildSemesterExport`→`parseSemesterImport` devuelve el semestre.
- [ ] **[CI]** `parse*` rechaza `_lectioType` incorrecto/ausente y payloads corruptos con el mensaje correcto.
- [ ] **[CI]** `resetSemesterStatuses` pone readings a `r-pending` y tasks a `t-pending`.
- [ ] **[CI]** `prepareImportedCourse` asigna ids frescos (uid stub) y preserva el resto de campos.
- [ ] **[CI]** `require('@lectio/core/integrations/lectio-file')` funciona en Node; `ipc-handlers.js` del desktop sin cambios.

### 12b — Import/export en móvil (share sheet + document picker) (`12b-mobile-import-export`)

- [ ] **[CI]** Exactamente **tres** deps nuevas: `expo-file-system`, `expo-sharing`, `expo-document-picker`, fijadas por `expo install` a SDK 56.
- [ ] **[M]** (móvil→desktop) Exportar un semestre en móvil → el `.lectio.json` se importa en el **desktop** sin cambios.
- [ ] **[M]** (desktop→móvil) Exportar un semestre en desktop → importarlo en móvil (Keep vs Reset de estados ambos funcionan).
- [ ] **[M]** (móvil) Importar con id en conflicto → entra como **id nuevo**, nunca sobrescribe en silencio.
- [ ] **[M]** (móvil↔desktop) Exportar un curso en móvil → importar en otro semestre del desktop y viceversa; los cursos importados reciben **ids frescos** y no colisionan.
- [ ] **[M]** Los archivos son byte-compatibles con el envelope del desktop (`_lectioType`/`_version` + proyección).

---

## Pruebas de regresión cruzada (correr al final de toda la serie)

- [ ] **[M]** (móvil↔desktop) Un semestre creado en móvil se ve correcto en desktop y al revés (mismo JSON).
- [ ] **[M]** (móvil) Flujo completo de cuenta nueva: sign-in → tutorial → crear semestre (calendario) → cursos → ítems con tags → Study Mode → Sort → Breakdown → exportar → feedback.
- [ ] **[M]** (móvil) Tags custom + ghosting + Study Mode conviven sin romper el progreso.
- [ ] **[M]** (móvil) Reabrir la app aterriza en el último semestre, con Study Mode y Sort recordados.
- [ ] **[CI]** Suite completa de Vitest verde y typecheck del móvil en 0 tras integrar todo en `dev`.
