FROM oven/bun:1.4.3
WORKDIR /app
# This collector uses Bun built-ins only. No registry install or frontend secrets.
COPY apps/results-collector/src ./apps/results-collector/src
COPY scripts/sos-results.ts ./scripts/sos-results.ts
USER bun
ENV SOS_COLLECTOR_ENABLED=false
HEALTHCHECK --interval=1m --timeout=70s --start-period=30s --retries=3 CMD ["bun", "run", "apps/results-collector/src/main.ts", "health"]
CMD ["bun", "run", "apps/results-collector/src/main.ts"]
