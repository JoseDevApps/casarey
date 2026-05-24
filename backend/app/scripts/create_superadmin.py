"""Crear o promover un usuario a SUPER_ADMIN.

Uso:
  docker compose exec backend python -m app.scripts.create_superadmin
  docker compose exec backend python -m app.scripts.create_superadmin \
    --email admin@ejemplo.com --password "secreto" --name "Admin"

Si el email ya existe, lo promueve a SUPER_ADMIN y actualiza la contraseña.
"""
import argparse
import asyncio
import getpass
import sys

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.core.security import hash_password
from app.models.user import User, UserRole


async def create_or_promote(email: str, password: str, full_name: str) -> None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.email == email))
        existing = result.scalar_one_or_none()

        if existing:
            existing.role = UserRole.SUPER_ADMIN
            existing.password_hash = hash_password(password)
            existing.full_name = full_name
            existing.is_active = True
            existing.email_verified = True
            existing.must_change_password = False
            await db.commit()
            print(f"OK  {email} promovido a SUPER_ADMIN (contraseña actualizada)")
            return

        user = User(
            email=email,
            password_hash=hash_password(password),
            full_name=full_name,
            role=UserRole.SUPER_ADMIN,
            is_active=True,
            email_verified=True,
            must_change_password=False,
        )
        db.add(user)
        await db.commit()
        print(f"OK  SUPER_ADMIN creado: {email}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Crear o promover un SUPER_ADMIN")
    parser.add_argument("--email", help="Email del super admin")
    parser.add_argument("--password", help="Contraseña (si no se pasa, se solicita por prompt)")
    parser.add_argument("--name", default="Super Admin", help="Nombre completo (default: 'Super Admin')")
    args = parser.parse_args()

    email = (args.email or input("Email: ")).strip()
    if not email:
        print("ERROR: email es obligatorio", file=sys.stderr)
        sys.exit(1)

    password = args.password or getpass.getpass("Password: ")
    if not password or len(password) < 8:
        print("ERROR: la contraseña debe tener al menos 8 caracteres", file=sys.stderr)
        sys.exit(1)

    asyncio.run(create_or_promote(email, password, args.name))


if __name__ == "__main__":
    main()
