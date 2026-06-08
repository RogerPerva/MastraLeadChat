# --- Etapa 1: build ---
# Usamos Node 22 (versión que exige el proyecto) en Alpine (imagen mínima, ~50MB vs ~300MB).
# Esta etapa instala dependencias y compila; su resultado se copia a la etapa final.
FROM node:22-alpine AS builder

WORKDIR /app

# Copiamos primero solo los archivos de dependencias para aprovechar la caché de Docker:
# si no cambia package.json, Docker reutiliza la capa de npm install sin reinstalar todo.
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

# Ahora copiamos el resto del código fuente y compilamos.
COPY . .
RUN npm run build

# --- Etapa 2: imagen final ---
# Solo copiamos el output compilado, sin el código fuente ni devDependencies.
# Resultado: imagen final más pequeña y sin superficie de ataque innecesaria.
FROM node:22-alpine AS runner

WORKDIR /app

# El build de Mastra produce un bundle autocontenido en .mastra/output/.
# No necesita node_modules propios: todas las dependencias están dentro del bundle.
COPY --from=builder /app/.mastra/output ./

# Render inyecta PORT en tiempo de ejecución. Mastra respeta esta variable para elegir puerto.
EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "./index.mjs"]
