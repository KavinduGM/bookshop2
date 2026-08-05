# PressTrack — print shop job tracker (UI demo)
#
# The app is a single self-contained HTML file: no build step, no dependencies,
# no runtime. nginx just serves it.

FROM nginx:1.27-alpine

LABEL org.opencontainers.image.title="PressTrack" \
      org.opencontainers.image.description="Print shop job tracking system — UI demo" \
      org.opencontainers.image.source="https://github.com/KavinduGM/bookshop2"

RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/app.conf
COPY index.html /usr/share/nginx/html/index.html

EXPOSE 80

# Dokploy and Docker both use this to tell "container started" from "site actually up".
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
