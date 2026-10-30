# GCash Loyalty POC: one container serves the API (/api/v1) and all four SPAs.
FROM node:22-bookworm-slim

WORKDIR /app
ENV NODE_ENV=development \
    PORT=4000 \
    NPM_CONFIG_UPDATE_NOTIFIER=false

# Install workspace deps first for better layer caching.
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json      apps/api/
COPY apps/customer/package.json apps/customer/
COPY apps/merchant/package.json apps/merchant/
COPY apps/admin/package.json    apps/admin/
COPY apps/pos/package.json      apps/pos/
COPY packages/shared/package.json packages/shared/
COPY packages/ui/package.json     packages/ui/
RUN npm ci --no-audit --no-fund

# Build the four Vite front ends (the API runs from source via tsx).
COPY . .
RUN npm run build \
 && chown -R node:node /app/apps/api/data

USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://localhost:4000/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npm", "start"]
