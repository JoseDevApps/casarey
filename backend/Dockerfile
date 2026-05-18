FROM python:3.12-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends curl ffmpeg \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system appgroup \
    && useradd --system --gid appgroup --no-create-home appuser
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh && chown -R appuser:appgroup /app
USER appuser
EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD curl -f http://localhost:8000/health || exit 1
ENTRYPOINT ["/entrypoint.sh"]
