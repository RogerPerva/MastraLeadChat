# CONTEXT.md — Lead Qualification Agent

> **Para la IA que lea esto:** este es un proyecto de aprendizaje. El dueño está
> **empezando** y quiere ENTENDER lo que se construye para poder hacerlo manualmente
> después. Al ayudar: explica el *porqué* de cada cambio en español, con lenguaje
> claro y analogías, prefiere patrones transferibles sobre "magia" del framework, y
> haz preguntas de alineación cuando algo sea ambiguo. No solo entregues código que
> funcione: enséñalo.

---

## 1. ¿Qué es este proyecto?

Un **chatbot de intake comercial con IA**. No es "solo un chatbot": es un sistema que
captura prospectos (leads), entiende su necesidad, les pone una calificación comercial
(score) y los guarda. Más adelante podrá leer PDFs de requerimientos y mandar los
mejores leads a HubSpot.

Flujo central:

```
mensaje del lead
      ↓
[IA] analiza y extrae datos estructurados
      ↓
[reglas] calcula un score 0–100
      ↓
[Supabase] guarda el lead (califique o no)
      ↓
[futuro] si score alto → HubSpot
```

Construido con **Mastra** (framework de agentes/workflows en TypeScript).

---

## 2. La idea más importante (el "modelo mental")

> **El AGENTE interpreta. El WORKFLOW controla.**

- El **agente** (IA) solo hace una cosa: convertir texto libre en **datos
  estructurados** (¿tiene presupuesto? ¿urgencia? ¿qué necesita?).
- El **workflow** es una secuencia **fija** de pasos que TÚ controlas. Las decisiones
  importantes (el score, guardar en base) son **código determinista**, no dependen del
  modelo.

¿Por qué? Porque las decisiones comerciales deben ser **estables y repetibles**. Si la
IA decidiera sola el score, el mismo lead podría calificar distinto cada vez. Con reglas
fijas, no.

---

## 3. Mapa de archivos (qué hace cada uno)

```
src/mastra/
├── index.ts                         # Registra TODO en Mastra (agentes, workflows, storage)
│
├── agents/
│   └── lead-agent.ts                # IA que SOLO extrae datos del mensaje (sin tools)
│
├── workflows/
│   └── lead-qualification-workflow.ts   # El "director de orquesta": 3 pasos en orden
│
├── tools/
│   ├── score-lead-tool.ts           # Reglas de score (función pura calculateLeadScore)
│   ├── save-lead-tool.ts            # Inserta en Supabase (función pura insertLead)
│   ├── create-hubspot-contact-tool.ts   # STUB — para Fase 4 (HubSpot)
│   └── extract-pdf-text-tool.ts     # STUB — para Fase 2 (PDF)
│
├── services/
│   ├── supabase.service.ts          # Cliente de Supabase (usa SERVICE_ROLE_KEY, solo backend)
│   └── pdf.service.ts               # STUB — leerá PDFs reales en Fase 2
│
└── schemas/
    └── lead.schema.ts               # Contratos de datos (Zod) reutilizables
```

> Los archivos `weather-*` son ejemplos que vinieron con la plantilla de Mastra. Puedes
> borrarlos cuando quieras; no afectan el sistema de leads.

---

## 4. Cómo fluye un lead, paso a paso

Todo vive en `workflows/lead-qualification-workflow.ts`, que encadena 3 *steps*:

1. **`analyze-lead`** — Llama al agente con `structuredOutput`. La IA devuelve un objeto
   ya validado (en `response.object`) con: datos de contacto, `need`, y señales
   booleanas (`hasBudget`, `hasUrgency`, `hasDecisionAuthority`, `hasClearNeed`) +
   `fitLevel`.

2. **`score-lead-step`** — Llama a la función pura `calculateLeadScore(...)`. Suma
   puntos por reglas fijas:

   | Señal | Puntos si sí | si no |
   |-------|--------------|-------|
   | Presupuesto | 20 | 5 |
   | Urgencia | 20 | 5 |
   | Autoridad | 20 | 5 |
   | Claridad | 15 | 5 |
   | Fit | high=25 / medium=15 / low=5 | — |

   Total → estado: **≥75 `qualified`**, **≥50 `nurture`**, resto **`disqualified`**.

3. **`save-lead-step`** — Llama a `insertLead(...)`, que inserta en la tabla `leads` de
   Supabase y devuelve el `leadId`. **Se guardan todos los leads**, califiquen o no
   (para medir conversión después).

---

## 5. Conceptos de Mastra que SÍ o SÍ debes recordar

Estos detalles causaron bugs reales al inicio. Son la fuente #1 de confusión:

### a) Tool vs Step: reciben el input distinto
- **TOOL** (`createTool`): el input llega como **primer argumento directo**.
  ```ts
  execute: async (inputData) => { inputData.email }   // ✅
  ```
- **STEP** (`createStep`): el input llega **dentro de un objeto**.
  ```ts
  execute: async ({ inputData, mastra }) => { inputData.email }   // ✅
  ```
  Usar `({ inputData })` dentro de una **tool** deja todo `undefined`.

### b) `getAgent` usa la LLAVE de registro, no el `id`
En `index.ts` se registra `agents: { leadAgent }` → se obtiene con
`mastra.getAgent("leadAgent")`, **no** con el `id: "lead-agent"`.

### c) No existe `mastra.getTool(...)`
Para usar la lógica de una tool dentro de un workflow, **separamos la lógica en una
función pura** (ej. `calculateLeadScore`, `insertLead`) y la importamos directo. La tool
solo "envuelve" esa función para exponerla a Mastra. Esto además hace la lógica fácil de
probar sin Mastra.

### d) Salida estructurada en vez de `JSON.parse`
Para que la IA devuelva JSON confiable:
```ts
const res = await agent.generate(prompt, { structuredOutput: { schema } });
res.object   // ✅ objeto ya validado contra el schema (Zod)
```
Nunca `JSON.parse(res.text)` (se rompe si el modelo agrega texto extra).

### e) Todo se registra en `index.ts`
Un agente o workflow que no esté en `new Mastra({ agents, workflows })` **no existe**
para Studio ni para la API.

---

## 6. Cómo correrlo y probarlo

```shell
npm run dev
```
Abre **Mastra Studio** en http://localhost:4111 → workflow
`lead-qualification-workflow` → **Run** → escribe un mensaje de prueba.

> ⚠️ En Windows, **no dejes dos `mastra dev` corriendo a la vez**: pelean por el archivo
> `mastra.duckdb` y truena con un error de "file is being used by another process". Corre
> solo uno.

Variables necesarias en `.env` (Fase 1): `OPENAI_API_KEY`, `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`. **`.env` está en `.gitignore`: nunca lo subas a git.**

---

## 7. Roadmap (en qué fase vamos)

- ✅ **Fase 1 — MVP (HECHA):** `mensaje → análisis → score → Supabase`.
- ✅ **Fase 2 — PDF (HECHA):** `unpdf` instalado, `pdf.service.ts` implementado,
  nuevo paso `extract-pdf-step` al inicio del workflow. El input del workflow
  ahora acepta `pdfBase64` (opcional). Frontend de prueba en `public/intake.html`.
- ⬜ **Fase 3 — HubSpot:** crear contacto/ticket cuando el score sea muy alto (≥75). La
  tool `create-hubspot-contact-tool.ts` ya existe como esqueleto.
- ⬜ **Fase 4 — API Gateway (Layered Architecture):** crear una API propia en
  Express o Next.js que envuelva a Mastra. Mastra deja de estar expuesto al
  público. Esta capa agrega: autenticación (JWT o API keys), validación de input
  (Zod como DTO), rate limiting, y SSE (Server-Sent Events — conexión abierta
  donde el servidor empuja eventos al navegador sin polling). Patrón:
  Clean Architecture + API Gateway Pattern.
- ⬜ **Fase 5 — RAG ligero:** solo para lineamientos internos, no para todo (ahorra
  tokens).

### Arquitectura objetivo (Fase 4+)

```
[Navegador / App móvil]
        ↓  HTTPS + token de sesión
[Tu API — Express o Next.js]   ← Controller: auth, validación, rate limit
        ↓  Mastra SDK (interno, nunca expuesto)
[Mastra]
        ↓
[OpenAI + Supabase + HubSpot]
```

Patrones involucrados:
- **Layered Architecture** — capas con responsabilidad única (Controller → Service → Repository)
- **Separation of Concerns** — cada archivo hace solo una cosa
- **API Gateway Pattern** — un portero entre el exterior y los servicios internos
- **Clean Architecture** — las reglas de negocio no dependen de frameworks ni HTTP

---

## 8. Tabla `leads` en Supabase (referencia de columnas)

`name, email, phone, company, role, lead_type, need, budget, timeline, score, status,
qualification_reason, hubspot_contact_id`

---

## 9. Pendientes de higiene

- Regenerar `SUPABASE_SERVICE_ROLE_KEY` y `HUBSPOT_ACCESS_TOKEN`: estuvieron expuestas en
  el índice de git al inicio del proyecto.
- Limpiar archivos temporales: `mastra-chat/create-test-pdf.mjs` y `mastra-chat/test-lead.pdf`
- El proyecto raíz `mastrachat/` (fuera de `mastra-chat/`) es un esqueleto vacío que
  nunca se usó. Su `src/index.ts`, `package.json` y `.env` no los lee nadie. Se puede
  ignorar o eliminar para evitar confusión.

---

## 10. Estado al cierre de sesión — dónde continuar

**Fecha:** 2026-06-07

### Lo que se hizo en esta sesión
- Diagnosticado y resuelto: workflow corría bien pero se accedía por la interfaz
  equivocada (chat del agente en vez de la sección Workflows del Studio).
- Implementada **Fase 2 (PDF)**: `pdf.service.ts` con `unpdf`, nuevo paso
  `extract-pdf-step` en el workflow, input `pdfBase64` opcional.
- Creado `public/intake.html`: frontend HTML real con subida de archivo PDF,
  llama a la API de Mastra con el patrón correcto (create-run → start → polling GET).
- Corregidas las URLs de la API de Mastra:
  - `POST /api/workflows/leadQualificationWorkflow/create-run` → devuelve `{ runId }`
  - `POST /api/workflows/leadQualificationWorkflow/start?runId=X` → inicia el workflow
  - `GET  /api/workflows/leadQualificationWorkflow/runs/:runId` → consulta resultado
  - La clave del workflow en la URL es `leadQualificationWorkflow` (camelCase), no el id.
- Auditada la arquitectura: proyecto raíz vacío identificado, estructura explicada.

### Próximo paso inmediato: Fase 3 — HubSpot

**Bloqueado por:** token de HubSpot inválido. El token actual es un Developer API Key
del portal de desarrollador de HubSpot, no un Private App token del CRM.

**Qué hacer al inicio de la próxima sesión:**
1. Ir a **app.hubspot.com** (cuenta CRM, NO developers.hubspot.com)
2. Settings → Integrations → **Private Apps** → Create a private app
3. Activar scopes: `crm.objects.contacts.read` y `crm.objects.contacts.write`
4. Copiar el token generado (formato `pat-na1-...`) y ponerlo en `mastra-chat/.env`
   como `HUBSPOT_ACCESS_TOKEN`
5. Implementar `create-hubspot-contact-tool.ts` (el esqueleto ya existe)
6. Agregar un paso condicional al workflow: si `score ≥ 75` → llamar a HubSpot

**Concepto clave aprendido (para no olvidar):**
- La API Key clásica de HubSpot (UUID) está deprecada para el CRM v3.
- El Developer API Key (`CiR...`) sirve para el portal de desarrollador, no para CRM.
- Para operaciones de CRM en producción siempre usar **Private App token** (`pat-...`).
