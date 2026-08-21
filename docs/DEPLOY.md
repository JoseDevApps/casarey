# Despliegue en producción — Casas de Campo

Guía completa para poner la plataforma en un servidor propio con dominio y HTTPS.

---

## 1. Requisitos del servidor

| Recurso | Mínimo recomendado |
|---|---|
| CPU / RAM | 2 vCPU / 4 GB (el build de Next.js es lo más pesado) |
| Disco | 20 GB (imágenes Docker + volúmenes de MinIO y Postgres) |
| SO | Linux con Docker Engine y Docker Compose v2 |
| Dominio | Uno apuntando al servidor (ej. `casarey.com`) |
| Certificado | HTTPS válido — **obligatorio**: WhatsApp exige HTTPS para el webhook |

---

## 2. Clonar y configurar

```bash
git clone https://github.com/JoseDevApps/casarey.git
cd casarey
cp .env.example .env
```

Edita `.env` con los valores reales. **Este archivo nunca se versiona** (está en `.gitignore`).

### Secretos — generar valores nuevos, no reutilizar los de desarrollo

```bash
openssl rand -hex 32   # para JWT_SECRET
openssl rand -hex 32   # para NEXTAUTH_SECRET
```

### `.env` de producción

```env
# Base de datos
DB_NAME=casas_campo
DB_USER=casas_user
DB_PASSWORD=<password largo y aleatorio>

# JWT / sesiones
JWT_SECRET=<openssl rand -hex 32>
NEXTAUTH_SECRET=<openssl rand -hex 32>

# MinIO
MINIO_USER=admin
MINIO_PASSWORD=<password largo y aleatorio>
MINIO_SECURE=false            # true solo si MinIO va detrás de HTTPS propio
NEXT_PUBLIC_MINIO_URL=https://TU-DOMINIO/media

# URLs públicas — sin barra final
FRONTEND_URL=https://TU-DOMINIO
NEXTAUTH_URL=https://TU-DOMINIO
CORS_ORIGINS=https://TU-DOMINIO

# Expiración de tokens
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7
EMAIL_VERIFICATION_EXPIRE_HOURS=24
PASSWORD_RESET_EXPIRE_MINUTES=30

# SMTP (canal de respaldo — sigue siendo necesario)
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_USERNAME=admin@tudominio.com
SMTP_PASSWORD=<password>
SMTP_ENCRYPTION=ssl
SMTP_FROM_EMAIL=admin@tudominio.com

# Endurecimiento (IMPORTANTE en producción)
COOKIE_SECURE=true            # cookies solo por HTTPS
COOKIE_SAMESITE=lax
COOKIE_DOMAIN=
TRUSTED_HOSTS=TU-DOMINIO
SECURITY_HEADERS_ENABLED=true
HSTS_ENABLED=true
HSTS_MAX_AGE=31536000

# WhatsApp Business Cloud API (Meta)
WHATSAPP_ENABLED=true
WHATSAPP_DRY_RUN=false
WHATSAPP_API_VERSION=v21.0
WHATSAPP_PHONE_NUMBER_ID=1234099639790949
WHATSAPP_BUSINESS_NUMBER=59177523239
WHATSAPP_ACCESS_TOKEN=<token permanente de System User>
WHATSAPP_VERIFY_TOKEN=<cadena que tú inventas, debe coincidir con Meta>
WHATSAPP_APP_SECRET=<App Secret de la app ClientesCabanas>
WHATSAPP_DEFAULT_COUNTRY_CODE=591
WHATSAPP_TEMPLATE_LANG=es
# Nombres de plantillas (por defecto ya coinciden con las creadas en Meta)

# OTP
OTP_EXPIRE_MINUTES=10
OTP_MAX_ATTEMPTS=5
OTP_RESEND_COOLDOWN_SECONDS=60
OTP_MAX_SENDS_PER_HOUR=5
```

⚠️ `COOKIE_SECURE=true` **rompe el login si el sitio no está en HTTPS**. Configura el
certificado antes de activarlo.

---

## 3. Levantar los servicios

```bash
docker compose build --no-cache backend frontend
docker compose up -d
docker compose ps        # los 4 servicios deben quedar (healthy)
```

Las **migraciones se aplican solas** al arrancar el backend (`entrypoint.sh` ejecuta
`alembic upgrade head`). Verificación:

```bash
docker exec $(docker compose ps -q backend) alembic current   # debe decir (head)
```

> **Nota sobre rebuilds:** si tras un `git pull` el contenedor sigue con código viejo,
> usa `docker compose build --no-cache <servicio>` y luego
> `docker compose up -d --force-recreate <servicio>`. Confirma con
> `docker images <img> --format "{{.CreatedSince}}"` que la imagen sea reciente.

---

## 4. Reverse proxy y HTTPS

Los contenedores publican `3100` (frontend) y `8100` (backend) en localhost. Delante va
un proxy con TLS. Ejemplo con Nginx + Certbot:

```nginx
server {
    listen 443 ssl http2;
    server_name TU-DOMINIO;

    ssl_certificate     /etc/letsencrypt/live/TU-DOMINIO/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/TU-DOMINIO/privkey.pem;

    client_max_body_size 64M;          # subida de imágenes y videos

    # Aplicación (el frontend enruta /api/* al backend)
    location / {
        proxy_pass http://127.0.0.1:3100;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Archivos públicos de MinIO (imágenes de propiedades, banners)
    location /media/ {
        proxy_pass http://127.0.0.1:9000/;
        proxy_set_header Host $host;
    }
}

server {
    listen 80;
    server_name TU-DOMINIO;
    return 301 https://$host$request_uri;
}
```

Certificado:

```bash
certbot --nginx -d TU-DOMINIO
```

> Para servir `/media/` hay que publicar el puerto 9000 de MinIO en localhost. En
> `docker-compose.yml` el servicio `minio` solo expone `9001` (consola); añade
> `- "127.0.0.1:9000:9000"` a sus `ports` si vas a usar esta ruta.

---

## 5. Configurar el webhook de WhatsApp

Necesario para el respaldo click-to-chat y para recibir eventos de Meta.

1. [developers.facebook.com](https://developers.facebook.com) → app **ClientesCabanas** →
   **WhatsApp** → **Configuración** → sección **Webhooks**
2. **URL de devolución de llamada**: `https://TU-DOMINIO/api/webhooks/whatsapp`
3. **Token de verificación**: el mismo valor de `WHATSAPP_VERIFY_TOKEN`
4. **Verificar y guardar**
5. **Administrar** → activar el campo **`messages`**

Comprobación manual del handshake:

```bash
curl "https://TU-DOMINIO/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=TU_TOKEN&hub.challenge=PRUEBA"
# debe devolver: PRUEBA
```

> El proxy del frontend reenvía `X-Hub-Signature-256`, así que la validación de firma
> con `WHATSAPP_APP_SECRET` funciona a través de `https://TU-DOMINIO/api/...`.

---

## 6. Crear el primer Super Admin

El registro público siempre crea usuarios `CLIENT`. Regístrate desde la web y luego:

```bash
docker exec -it $(docker compose ps -q db) \
  psql -U casas_user -d casas_campo \
  -c "UPDATE users SET role='SUPER_ADMIN', email_verified=true WHERE email='tu@correo.com';"
```

Desde ese usuario ya puedes asignar los roles `ADMIN` y `TECH_ADMIN` en el panel de Usuarios.

---

## 7. Verificación posterior al despliegue

```bash
# Servicios sanos
docker compose ps

# Migraciones al día
docker exec $(docker compose ps -q backend) alembic current

# WhatsApp operativo
docker exec $(docker compose ps -q backend) python -c \
  "from app.services import whatsapp_service; print('can_deliver =', whatsapp_service.can_deliver())"

# La app responde
curl -sI https://TU-DOMINIO | head -1
```

Prueba funcional recomendada:

1. Registrar una cuenta eligiendo **WhatsApp** → el código debe llegar al teléfono
2. Verificar el código e iniciar sesión
3. Crear una propiedad como ADMIN y hacer una reserva de prueba
4. Aprobarla y comprobar la notificación

Si algo no llega, los logs dicen exactamente qué pasó:

```bash
docker compose logs -f backend | grep -E "WhatsApp|OTP|Fallo"
```

---

## 8. Respaldos

```bash
# Base de datos
docker exec $(docker compose ps -q db) \
  pg_dump -U casas_user casas_campo | gzip > backup-$(date +%F).sql.gz

# Archivos (MinIO)
docker run --rm -v casarey_minio_data:/data -v $(pwd):/backup alpine \
  tar czf /backup/minio-$(date +%F).tar.gz /data
```

Programa ambos en cron y guárdalos fuera del servidor.

---

## 9. Notas de operación

- **Rotar el token de Meta** si se filtró: Business Settings → Usuarios del sistema →
  Generar token. Solo hay que actualizar `WHATSAPP_ACCESS_TOKEN` y reiniciar el backend.
- **Plantillas de WhatsApp**: viven en Meta, por WABA. Si cambias de número/cuenta hay que
  recrearlas. Los textos exactos están en `specs/003-whatsapp-notifications/research.md`.
- **Fallback automático**: si WhatsApp falla, las notificaciones salen por correo. Nunca se
  pierden, pero conviene vigilar los `WARNING` del log.
- **Actualizar la app**:
  ```bash
  git pull
  docker compose build --no-cache backend frontend
  docker compose up -d --force-recreate
  ```
