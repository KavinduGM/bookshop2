# Warnitha Printshop — order tracking system
#
# One small Node image serving both the API and the page. The database runs in
# its own container (see docker-compose.yml).

FROM node:22-alpine

LABEL org.opencontainers.image.title="Warnitha Printshop Order Tracking" \
      org.opencontainers.image.source="https://github.com/KavinduGM/bookshop2"

ENV NODE_ENV=production
WORKDIR /app

# Dependencies first, so a change to the app doesn't reinstall them.
COPY server/package.json server/package-lock.json* ./server/
RUN cd server && npm install --omit=dev --no-audit --no-fund

COPY server/ ./server/
COPY index.html ./index.html

# Don't run as root.
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/healthz',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "server/server.js"]
