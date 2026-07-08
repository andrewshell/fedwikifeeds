FROM node:24 AS dependencies

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:24 AS runtime

WORKDIR /app

COPY --from=dependencies /app/node_modules node_modules
COPY . .

# Default listen port (config.js PORT default). Documentation only — override
# PORT at runtime and publish the matching port if you change it. Persistence
# of ./data (feed/roster cache) is handled by the runtime volume mount, e.g.
# the `volumes:` entry in examples/dockge/compose.yaml — not declared here.
EXPOSE 3000

CMD ["node", "bin/www.js"]
