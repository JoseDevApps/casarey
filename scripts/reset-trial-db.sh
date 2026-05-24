#!/usr/bin/env bash
set -euo pipefail

SUPERADMIN_EMAIL="${SUPERADMIN_EMAIL:-admin@jfibanez.com}"
SUPERADMIN_PASSWORD="${SUPERADMIN_PASSWORD:-Lionhard_123!}"
SUPERADMIN_NAME="${SUPERADMIN_NAME:-Super Admin}"
AUTO_CONFIRM=false

usage() {
  cat <<'EOF'
Resetea la base de datos de prueba y crea/promueve un SUPER_ADMIN.

Uso:
  ./scripts/reset-trial-db.sh --yes

Opciones:
  --email <correo>       Email del super admin (default: admin@jfibanez.com)
  --password <clave>     Password del super admin (default: Lionhard_123!)
  --name <nombre>        Nombre del super admin (default: Super Admin)
  --yes                  Ejecuta sin confirmación interactiva
  --help                 Muestra esta ayuda

Qué hace:
  1) Levanta db/minio
  2) Elimina TODO en la DB (DROP SCHEMA public CASCADE)
  3) Recreate schema public
  4) Recreate backend/frontend (aplica migraciones)
  5) Crea/promueve SUPER_ADMIN con las credenciales indicadas
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --email)
      SUPERADMIN_EMAIL="$2"
      shift 2
      ;;
    --password)
      SUPERADMIN_PASSWORD="$2"
      shift 2
      ;;
    --name)
      SUPERADMIN_NAME="$2"
      shift 2
      ;;
    --yes)
      AUTO_CONFIRM=true
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Opción no reconocida: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ "${AUTO_CONFIRM}" != "true" ]]; then
  echo "ATENCION: este proceso borra TODOS los datos de la base actual."
  echo "Proyecto: $(basename "$(pwd)")"
  echo "Super admin final: ${SUPERADMIN_EMAIL}"
  read -r -p "Escribe RESET para continuar: " confirm
  if [[ "${confirm}" != "RESET" ]]; then
    echo "Operación cancelada."
    exit 1
  fi
fi

echo "[1/6] Levantando db y minio..."
docker compose up -d db minio

echo "[2/6] Esperando disponibilidad de PostgreSQL..."
for i in $(seq 1 60); do
  if docker compose exec -T db sh -lc 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1'; then
    ready=true
    break
  fi
  ready=false
  sleep 2
done

if [[ "${ready}" != "true" ]]; then
  echo "PostgreSQL no respondió a tiempo." >&2
  exit 1
fi

echo "[3/6] Reseteando esquema public..."
docker compose exec -T db sh -lc \
  'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"'

echo "[4/6] Recreando backend y frontend (migraciones incluidas)..."
docker compose up -d --force-recreate backend frontend

echo "[5/6] Creando/promoviendo SUPER_ADMIN..."
docker compose exec -T backend python -m app.scripts.create_superadmin \
  --email "${SUPERADMIN_EMAIL}" \
  --password "${SUPERADMIN_PASSWORD}" \
  --name "${SUPERADMIN_NAME}"

echo "[6/6] Verificación de usuario(s):"
docker compose exec -T db sh -lc \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT email, role, is_active, email_verified FROM users ORDER BY created_at;"'

echo "Listo. Base reseteada y superadmin preparado."
