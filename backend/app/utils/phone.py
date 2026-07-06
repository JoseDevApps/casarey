"""Normalización de teléfonos al formato E.164 SIN '+' (el que exige la API de Meta).

Mercado principal: Bolivia (+591, celulares de 8 dígitos que empiezan en 6 o 7).
Números internacionales se aceptan tal cual si tienen una longitud plausible.
"""

import re

_CLEAN_RE = re.compile(r"[\s\-().]+")


def normalize_phone_e164(raw: str, default_country: str = "591") -> str:
    """Devuelve el número en E.164 sin '+' (ej. '59171234567').

    Lanza ValueError si el número no es normalizable.
    """
    if not raw or not raw.strip():
        raise ValueError("Número de teléfono vacío")

    cleaned = _CLEAN_RE.sub("", raw.strip())
    if cleaned.startswith("+"):
        cleaned = cleaned[1:]
    # Prefijo internacional 00 (ej. 0059171234567)
    if cleaned.startswith("00"):
        cleaned = cleaned[2:]

    if not cleaned.isdigit():
        raise ValueError("El teléfono solo puede contener dígitos y separadores")

    # Celular boliviano local: 8 dígitos empezando en 6 o 7
    if len(cleaned) == 8 and cleaned[0] in ("6", "7"):
        return f"{default_country}{cleaned}"

    # Ya viene con código de país boliviano
    if cleaned.startswith(default_country) and len(cleaned) == len(default_country) + 8:
        return cleaned

    # Internacional genérico: 10-15 dígitos (E.164 permite hasta 15)
    if 10 <= len(cleaned) <= 15:
        return cleaned

    raise ValueError("Número de teléfono inválido")


def is_valid_phone(raw: str, default_country: str = "591") -> bool:
    try:
        normalize_phone_e164(raw, default_country)
        return True
    except ValueError:
        return False
