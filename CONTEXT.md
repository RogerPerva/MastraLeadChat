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
(score), los guarda y manda los leads calificados a HubSpot.

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
si score ≥75 → crea o actualiza contacto en HubSpot
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
│   └── lead-qualification-workflow.ts   # El "director de orquesta": 5 pasos en orden
│
├── routes/
│   └── intake.route.ts              # Única entrada pública: POST /intake
│
├── public/
│   └── intake.html                  # Formulario público servido por Mastra
│
├── tools/
│   ├── score-lead-tool.ts           # Reglas de score (función pura calculateLeadScore)
│   ├── save-lead-tool.ts            # Inserta en Supabase (función pura insertLead)
│   ├── create-hubspot-contact-tool.ts   # Crea/actualiza contactos por email en HubSpot
│   └── extract-pdf-text-tool.ts     # Tool registrada para extraer texto de PDFs
│
├── services/
│   ├── supabase.service.ts          # Cliente de Supabase (usa SERVICE_ROLE_KEY, solo backend)
│   ├── pdf.service.ts               # Extrae texto real de PDFs con unpdf
│   └── rate-limit.service.ts        # Rate limiting simple en memoria para POST /intake
│
└── schemas/
    ├── lead.schema.ts               # Contrato de salida estructurada del agente
    └── intake.schema.ts             # Contrato de entrada/salida pública de POST /intake
```

> Los archivos `weather-*` de la plantilla original de Mastra fueron eliminados.

---

## 4. Cómo fluye un lead, paso a paso

Todo vive en `workflows/lead-qualification-workflow.ts`, que encadena 5 *steps*:

0. **`extract-pdf-step`** — Si llega `pdfBase64`, convierte el PDF a texto con `unpdf`,
   valida tamaño máximo y recorta el contexto a 20,000 caracteres. Si no hay PDF, pasa
   solo el mensaje.

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

4. **`sync-qualified-lead-with-hubspot-step`** — Si el score es ≥75 y existe email,
   crea o actualiza el contacto en HubSpot usando el email como identificador y guarda
   su ID en `hubspot_contact_id`. Si HubSpot falla, el lead guardado no se pierde.

Además del workflow, la entrada pública pasa primero por `routes/intake.route.ts`:

- valida el JSON con `intakeInputSchema`
- exige que el email venga dentro del `message`
- aplica rate limiting básico por IP
- ejecuta el workflow por detrás y solo devuelve `{ leadId, score, status }`

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
Abre la URL que imprima la terminal para **Mastra Studio**. Normalmente será
`http://0.0.0.0:4111` o `http://0.0.0.0:4112`, según si ya hay otro proceso usando el
puerto anterior.

Para probar el flujo público:

1. Abre `/` o `/intake.html`
2. Envía un mensaje que incluya un email válido
3. Opcionalmente adjunta un PDF
4. El backend responderá con `leadId`, `score` y `status`

> ⚠️ En Windows, **no dejes dos `mastra dev` corriendo a la vez**: pelean por el archivo
> `mastra.duckdb` y truena con un error de "file is being used by another process". Corre
> solo uno.

Variables necesarias en `.env` (Fase 1): `OPENAI_API_KEY`, `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`. Para Fase 3 se agrega `HUBSPOT_ACCESS_TOKEN`. Puedes copiar
`.env.example` como base. **`.env` está en `.gitignore`: nunca lo subas a git.**

Para desplegar públicamente también es obligatoria `ADMIN_API_KEY`. Protege las rutas
internas de Mastra; `POST /intake` permanece público, valida el payload y limita
solicitudes por IP.

Nota importante:
- Abrir `intake.html` como archivo local (`file://`) no funciona, porque el formulario
  hace `fetch("/intake")` y necesita servirse desde HTTP por Mastra.

---

## 7. Roadmap (en qué fase vamos)

- ✅ **Fase 1 — MVP (HECHA):** `mensaje → análisis → score → Supabase`.
- ✅ **Fase 2 — PDF (HECHA):** `unpdf` instalado, `pdf.service.ts` implementado,
  nuevo paso `extract-pdf-step` al inicio del workflow. El input del workflow
  ahora acepta `pdfBase64` (opcional). Frontend de prueba en `src/mastra/public/intake.html`.
- ✅ **Fase 3 — HubSpot:** crea o actualiza un contacto cuando el score es alto (≥75)
  y relaciona su ID con el lead guardado en Supabase.
- 🟨 **Fase 4 — API Gateway mínima para pruebas:** `POST /intake` ya envuelve al
  workflow con validación Zod, rate limiting en memoria y protección por API key para
  rutas internas. Pendiente para producción real: rate limiting distribuido, auth de
  usuarios y monitoreo.
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

---

## 10. Estado al cierre de sesión — dónde continuar

**Fecha:** 2026-06-08

### Lo que se hizo en esta sesión
- Implementado `POST /intake` público con validación Zod, rate limit en memoria y
  frontend servido desde `src/mastra/public/intake.html`.
- Hecho obligatorio el email dentro del `message` de entrada para evitar fallos del
  structured output cuando el modelo intentaba devolver `email: ""`.
- Conectada **Fase 3 (HubSpot)**: si `score >= 75`, el workflow crea o actualiza el
  contacto en HubSpot por email y guarda `hubspot_contact_id` en Supabase.
- Validación real completada: lead calificado respondió `201`, quedó en Supabase y
  `hubspot_contact_id` quedó poblado.
- Corregidos problemas operativos de desarrollo: rutas públicas, CORS al abrir
  `file://`, lock de `mastra.duckdb` por procesos duplicados y path estable de
  `mastra.db` / `mastra.duckdb`.

### Próximo paso inmediato: despliegue de prueba

Preparar el deploy público con variables de entorno completas:
`OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`HUBSPOT_ACCESS_TOKEN` y `ADMIN_API_KEY`.

Checklist mínima de despliegue:
1. Ejecutar `npm run build`
2. Desplegar `.mastra/output`
3. Configurar las variables de entorno
4. Verificar `GET /` y `POST /intake`
5. Confirmar que un lead calificado crea/actualiza contacto en HubSpot

**Concepto clave aprendido (para no olvidar):**
- HubSpot se trata como una sincronización posterior: Supabase guarda primero el lead.
- Si HubSpot falla temporalmente, el intake no debe perder el lead ya guardado.
- Para operaciones de CRM usar **Private App token** (`pat-...`) con permisos de contactos.
