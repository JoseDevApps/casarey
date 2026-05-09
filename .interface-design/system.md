# Cabañas Coroico — design system

> **Read this before any UI change.** Every decision below is rooted in
> the digitalized brand logo. Skipping this file = the next change drifts
> back to defaults.

## Direction

Editorial-rural. Cabaña en los Yungas a media tarde con luz cálida —
NO terminal estéril, NO SaaS azul, NO mobile-app vibrante.

The dark theme lives in **forest territory**, not generic "almost-black".
The brand is the brand: same palette and signature in public landing,
client dashboard, admin tools, and super-admin panel.

## Palette (semantic tokens, never raw hex in components)

Tokens are defined in `src/app/globals.css` as CSS variables.

| Role | Token | Hex | Use |
|---|---|---|---|
| Canvas | `--surface-0` | `rgb(8, 18, 13)` | Page background |
| Card | `--surface-1` | `rgb(20, 39, 29)` | Cards, sidebar, default surface |
| Elevated | `--surface-2` | `rgb(28, 52, 39)` | Hover surfaces, secondary cards |
| Popover | `--surface-3` | `rgb(36, 65, 49)` | Dropdowns, modals, tooltips |
| CTA band | `--surface-4` | `rgb(31, 61, 46)` | Forest CTA areas |
| Text primary | `--text-primary` | `#F4ECD8` (cream) | Headings, body |
| Text secondary | `--text-secondary` | `cream / 74%` | Supporting text |
| Text tertiary | `--text-tertiary` | `cream / 50%` | Metadata, labels |
| Text muted | `--text-muted` | `cream / 30%` | Disabled, placeholders |
| Brand primary | `--brand-primary` | `#1F3D2E` (forest) | Forest CTAs, badges |
| Brand accent | `--brand-accent` | `#C75A3A` (terracotta) | Primary action color, links, accent text |
| Brand warm | `--brand-warm` | `#E8A93A` (sun) | **Reserved for joy** — fresh highlights, super-admin chips, success glow |
| Borders | `--border-soft / mid / strong` | cream alphas | Whisper-quiet → emphasis |

**Rules**:
- Color carries meaning. Decorative gradients = forbidden.
- Sun (`--brand-warm`) is reserved — using it on every button kills the moment.
- Every accent button needs `color: var(--color-bone)` (~cream), never raw black on terra.

## Typography

Fonts loaded via `next/font/google` in `src/app/layout.tsx` — autohosted, zero CLS.

- **Fraunces** (italic 800) — wordmark + headlines + dialog titles + page-section subtitles
- **DM Sans** (400/500/600/700) — body, UI, inputs, buttons
- **JetBrains Mono** (400/500) — metadata, dates, IDs, tabular numbers, role labels in chips

Variables: `--font-serif`, `--font-sans`, `--font-mono`.

## Spacing & radius

- 4pt base unit. Tokens `--space-1..16`.
- Radius: `sm 4 / md 8 / lg 12 / xl 16 / full`.
- Cards: `rounded-2xl` (16px), inputs `rounded-md` (8), badges `rounded-full`.

## Depth strategy: **borders + cream-alpha**

Surfaces stack via background tint, not shadows. Borders disappear in the
squint test. The only places that DO use shadow are:

- Toasts (`0 12px 32px -12px`)
- Modals (`0 32px 64px -24px`)
- Hover states on primary/forest buttons (warm-tinted, very subtle)

Don't add shadow to cards. Don't add shadow to inputs. Don't add shadow to
sidebar items.

## Signature element: the **iniciales chip**

A single visual gesture appears in five places — that's how you know it's the
brand and not a template:

1. **Toast** — disco de icono semántico (CheckCircle / AlertCircle / Info / AlertTriangle), 28px, fondo `rgba(severity, 0.18)`.
2. **Modal de éxito** — disco verde-success grande (`56px`) con `CheckCircle2` y glow ámbar superior.
3. **UserMenu** (header público + sidebar) — chip `9px font-mono` con iniciales en `--brand-accent`, texto cream.
4. **Tabla de usuarios** — mismo chip `40px`, terra para clientes/admins, **sun + ink para super-admin** (alegría reservada).
5. **Avatares de cualquier futuro lugar** — siempre el mismo: terra circle + cream initials + tracking 0.04em.

Token CSS implícito: `font-family: var(--font-mono); letter-spacing: 0.04em; background: var(--brand-accent); color: var(--color-bone);`

## Logo system

Component: `src/components/logo.tsx`. Variants: `mark` (just the cabin)
and `full` (cabin + Cabañas Coroico wordmark in Fraunces italic).
Tones: `default` (sobre cream), `onForest` (sobre dark — el del proyecto)
y `monochrome` (currentColor).

The logo is server-rendered SVG inline. Never replace with `<img src>`.

## Motion

Defined in `src/app/globals.css` keyframes. **All animations express
cause-effect; nothing decorates.** All respect `prefers-reduced-motion`.

| Keyframe | Duration | Use |
|---|---|---|
| `fadeIn` | 140–220ms ease-out | Dropdowns, calendar range, in-range cells |
| `slideUp` | 180–260ms ease-out | Card entries, list items |
| `slideInRight` | 220ms cubic-bezier(0.22,0.61,0.36,1) | Toasts |
| `dialogIn` | 280ms cubic-bezier | Modals (Radix Dialog) |
| `pulseAccent` | 1.4s × 2 cycles | Highlight "recién creado" via `?fresh=1` |
| `shimmer` | 1.8s ease-in-out infinite | Skeleton overlay (`.skeleton` class) |

**Buttons**: `transition: 150ms ease-out` for color, `120ms` for transform.
Hover lifts `translateY(-1px)` + warm shadow. Active returns to 0.
Focus-visible: 2px terra ring offset 2.

## State patterns (pick one, commit)

For data that loads over the network, every page needs **four states explicitly**:

1. **Loading** — `<div className="h-X rounded-xl skeleton" style={{ background: 'var(--surface-1)' }} />` × 3-4 placeholders.
2. **Error** — colored card (`rgba(217, 99, 78, 0.08)` bg, `0.25` border) with body text + "Reintentar" link calling `mutate()`.
3. **Empty** — `<EmptyCard title subtitle />` pattern: surface-1 card with circular icon disc and Fraunces title + secondary subtitle.
4. **Success/data** — actual list/table.

Never render `{data && (<list>)}` without empty/error fallbacks. The user reading "I see nothing" is debugger-blind.

## Feedback hierarchy (this is the heart of "professional and sober")

| Severity / scope | Feedback |
|---|---|
| Tiny inline change (filter, sort) | Visual state in the UI itself |
| Routine action (approve, save, change role) | **Toast** with icon disc — 4.5s success / 6.5s error |
| Pivotal moment for the user (reservation created, first deploy) | **Modal de éxito** with summary, two CTAs ("Ver detalle" / "Inicio") |
| "You just did something, here it is" | **`?fresh=1` highlight** with `pulseAccent` 2 cycles + border `--brand-warm` |
| Logout / session-end | Toast "Sesión cerrada · ¡Hasta pronto!" + 600ms beat before redirect |

**Never** auto-dismiss success modals — the user reads them and chooses.
**Always** prefetch the destination route before showing the success modal.

## Auth flow

`lib/auth.ts` — pure helpers (client + server safe): `MeResponse`,
`UserRole`, `dashboardHomeForRole`, `roleLabel`, `initialsOf`.
`lib/auth-server.ts` — `getMe()` cached with `React.cache` for per-request dedup.

The user identity propagates via Server Component layouts (cookie → backend →
cached me). UI components receive `userInitials`, `userRoleLabel`,
`dashboardHref` as props — never re-fetch the user from a Client Component.

## Component library reused across the app

- `<Logo>` — see logo system above.
- `<UserMenu placement="header" | "sidebar" collapsed>` — single dropdown for both surfaces. Lives in `components/user-menu.tsx`.
- `<VoucherViewer variant="full" | "thumb" url minioKey>` — image lightbox, PDF link. Lives in `components/voucher-viewer.tsx`.
- `<ReservationSuccessDialog>` — sober success modal. Lives in `components/reservation-success-dialog.tsx`.
- `<StaticPageContent slug title lead icon>` — `/terms`, `/privacy`, `/contact` share the same layout.
- `<ToastProvider>` + `useToast()` — semantic toasts in `components/ui/toast.tsx`.

## Backend conventions that affect the UI

- All list endpoints return `{ items: [...], total, page?, page_size? }`. Frontend types must match — never `T[]`.
- IDs are UUIDs. URLs use them lowercase.
- Static pages: `/cms/pages/{slug}` returns `{ id, slug, content, updated_at? }`.
- MinIO URLs from the backend point to `http://minio:9000/...`. Use `toBrowserUrl()` to rewrite to `/minio/...` for the browser via Next.js rewrite. Bucket `payment-vouchers` is private — presigned URLs work through the rewrite because SigV4 signs `Host: minio:9000` which matches what Next proxies upstream.

## CSS layer architecture (don't break this)

Tailwind v4 declares `@layer theme, base, components, utilities;` — this
ordering means **utilities always win over components** regardless of file
position. The project's `globals.css` follows this discipline:

- **`@layer utilities`** — single-property tokens (`surface-N`, `text-*`,
  `border-*`, `font-*`). Here only because they need to compose freely
  with Tailwind's own utilities. Don't add multi-property classes here.
- **`@layer components`** — multi-property classes (`.btn-*`, `.card`,
  `.input-field`, `.badge-*`). They ALWAYS lose to Tailwind utilities.
  This is what allows `<input className="input-field pl-9" />` to
  actually get 36px of padding-left even though `.input-field` declares
  `padding: 10px 14px` shorthand.

If you write a multi-property component class anywhere outside
`@layer components`, you create a latent bug: any caller that adds a
Tailwind utility expecting to override (icons inside inputs, custom
padding on a button) will silently fail because the shorthand wins by
declaration order.

**Test**: before merging a new `.foo { padding: ... }` style, ask:
*"if a caller does `<el className='foo px-8'>`, does `px-8` win?"* If
the answer isn't yes, you're in the wrong layer.

## What to never do

- Don't add `--gray-700` style tokens. The whole point is Cabañas Coroico's territory.
- Don't use `<select>` HTML element. Use Radix DropdownMenu with iconography.
- Don't add a 5th accent color. Sun is the limit; gold/blue/purple kill the brand.
- Don't auto-dismiss success modals.
- Don't ship a page without empty + error + loading states.
- Don't render a `<a target="_blank">` around an image just because there's no time for a lightbox. There's always time — `VoucherViewer` exists.
- Don't place "Cerrar sesión" as a bare button. It belongs in `UserMenu`.

## Updating this file

If you add a reusable pattern (used 2+ times) or change a token, update
this file in the same PR. Page-specific deviations belong in
`.interface-design/pages/<page>.md` (overrides take priority over Master).
