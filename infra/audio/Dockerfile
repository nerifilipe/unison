FROM debian:bookworm-slim AS generate
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
COPY scripts/generate-demo-audio.sh /generate.sh
RUN sh /generate.sh
FROM minio/mc:RELEASE.2025-04-16T18-13-26Z
COPY --from=generate /audio /audio
COPY infra/audio/seed.sh /seed.sh
ENTRYPOINT ["/bin/sh", "/seed.sh"]
