# Backlog - Aplicación de renta de casas de campo

## Mapa de Arquitectura y Roles (RBAC)

- **Cliente:** Se enfoca en la experiencia de usuario, búsqueda, reserva y gestión de su estadía y acompañantes.

- **Administrador (Host):** Se encarga de la gestión operativa de sus propiedades, aprobación de huéspedes, verificación de pagos y finanzas de sus casas.

- **Super Admin (Root):** Control total del ecosistema, auditoría global y gestión del contenido (CMS). **Restricción:** Solo puede existir una única cuenta con este nivel de privilegio en toda la base de datos. Los roles se manejan como atributos de una misma tabla de usuarios para permitir escalabilidad.

---

## 📋 Backlog de Desarrollo Completo (User Stories)

### 1. Épica: Gestión de Usuarios y Autenticación

- **[Auth-01]** Como **Cliente**, quiero registrarme con mi email y contraseña para poder gestionar mis propias reservas.

- **[Auth-02]** Como **Usuario**, quiero iniciar sesión de forma segura para acceder a mi panel correspondiente basado en mi rol.

- **[Admin-01]** Como **Super Admin**, quiero visualizar la lista completa de clientes y administradores registrados en la plataforma.

- **[Admin-02]** Como **Super Admin**, quiero modificar los roles de los usuarios (ej. promover un Cliente a Administrador para que pueda subir sus casas).

- **[Admin-03]** Como **Sistema**, debo bloquear cualquier intento de creación, registro o escalamiento de privilegios hacia el rol de `SUPER_ADMIN` si ya existe un usuario activo con dicho rol, garantizando un único súper usuario.

### 2. Épica: Landing Page y Catálogo (Capa Cliente)

- **[Cat-01]** Como **Cliente**, quiero ver una Landing Page con tarjetas resumidas de las casas de campo para conocer las ofertas disponibles.

- **[Cat-02]** Como **Cliente**, quiero entrar al detalle de una casa (fotos, descripción, servicios) y consultar en tiempo real las fechas disponibles frente al calendario de la propiedad.

### 3. Épica: Operaciones de Propiedades y Anti-Overbooking

- **[Prop-01]** Como **Administrador**, quiero realizar el CRUD (Crear, Leer, Actualizar, Borrar) de mis casas de campo, incluyendo datos técnicos, políticas (check-in/out) y geolocalización.

- **[Prop-02]** Como **Administrador**, quiero configurar las tarifas base diferenciadas por tipo de persona (Adultos: 120 Bs / Niños: 60 Bs).

- **[Prop-03]** Como **Administrador**, quiero visualizar un calendario dinámico de mi propiedad que marque en rojo los días reservados, y que me permita bloquear fechas manualmente (por mantenimiento o uso personal) sin crear reservas falsas.

### 4. Épica: Reservas (Máquina de Estados e Inmutabilidad)

- **[Res-01]** Como **Cliente**, quiero cotizar mi estadía ingresando fechas y cantidad de personas. *Criterio de Aceptación: El sistema debe congelar (snapshot) los precios actuales y guardarlos en la reserva para garantizar la inmutabilidad financiera.*

- **[Res-02]** Como **Administrador**, quiero recibir solicitudes en estado `PENDING_APPROVAL` y revisarlas para aceptarlas (cambiando a `APPROVED_WAITING_PAYMENT`) o rechazarlas antes de proceder al cobro.

- **[Res-03]** Como **Administrador**, quiero solicitar y registrar la lista de huéspedes (Nombre, Número de Identificación, Teléfono) *únicamente* después de que la reserva alcance el estado `CONFIRMED`.

### 5. Épica: Pagos y Seguridad Transaccional

- **[Pay-01]** Como **Administrador**, quiero configurar mis métodos de pago, creando, editando y subiendo imágenes de referencia (ej. códigos QR o datos bancarios).

- **[Pay-02]** Como **Administrador**, quiero validar los comprobantes de pago subidos por los clientes. *Criterio de Aceptación Crítico: Al aprobar el pago, el sistema debe ejecutar una transacción segura que cambie la reserva a `CONFIRMED` y simultáneamente marque esas fechas como `BOOKED` en el calendario. Si algo falla, se revierte la acción.*

- **[Fin-01]** Como **Administrador**, quiero ver mis ingresos mensuales por casa calculados *siempre* sobre el total histórico guardado en las reservas completadas.

- **[Fin-02]** Como **Super Admin**, quiero tener una vista global de los montos cancelados en todas las casas de la plataforma para fines de auditoría.

### 6. Épica: CMS y Elementos Estáticos (Exclusivo Super Admin)

- **[CMS-01]** Como **Super Admin**, quiero acceder a un panel de Content Management System (CMS) para gestionar la Landing Page sin intervenir en el código.

- **[CMS-02]** Como **Super Admin**, quiero gestionar (Crear, Editar, Ocultar) los Banners Principales (Hero Section), cambiando imágenes, títulos y textos promocionales.

- **[CMS-03]** Como **Super Admin**, quiero editar los textos de información estática, como "Términos y Condiciones", "Políticas de Privacidad" y la "Información de Contacto" general.

- **[CMS-04]** Como **Super Admin**, quiero destacar propiedades seleccionando manualmente qué casas aparecerán en la sección de "Recomendadas" en la pantalla de inicio.

---

## 🛠️ Flujo Lógico del Negocio (Checklist de Estados)

1. **Solicitud (`PENDING_APPROVAL`):** Cliente cotiza fechas/personas $\rightarrow$ Se verifica disponibilidad $\rightarrow$ Se congela el precio.

2. **Pre-Aprobación (`APPROVED_WAITING_PAYMENT`):** Administrador acepta la solicitud $\rightarrow$ Cliente recibe luz verde para pagar.

3. **Pago y Transacción (`CONFIRMED`):** Cliente sube comprobante $\rightarrow$ Administrador aprueba $\rightarrow$ DB actualiza estado de reserva y bloquea calendario (`BOOKED`).

4. **Check-in / Habilitación:** Se habilita el registro de datos de los acompañantes (Booking_Guests).
