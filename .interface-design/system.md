# Cabanas Coroico — design system

> **Read this before any UI change.** The active direction comes from
> `C:/Users/CENTER INFORMATIC/Downloads/DESIGN.md`: **Yungas Morning Radiance**.

## Direction

Sun-drenched Yungas morning. The product should feel bright, calm, premium, and
human: warm mountain air, cream surfaces, clay edges, leaf accents, and a clear
orange action language.

The previous dark forest theme is no longer the default. Public pages,
client dashboards, admin tools, and super-admin panels all use the light system.
Use dark surfaces only for functional overlays such as image viewers and modal
scrims.

## Palette

Tokens are defined in `frontend/src/app/globals.css`.

| Role | Token | Hex | Use |
|---|---|---|---|
| Canvas | `--surface-0` | `#FBF9F5` | Page background |
| Card | `--surface-1` | `#FFFFFF` | Cards, sidebar, default surface |
| Hover / low | `--surface-2` | `#F5F3EF` | Hover surfaces, inputs, secondary panels |
| Popover | `--surface-3` | `#EFEEEA` | Dropdowns, modals, tooltips |
| CTA band | `--surface-4` | `#F2E8D5` | Warm section bands |
| Text primary | `--text-primary` | `#2D241E` | Headings, body |
| Text secondary | `--text-secondary` | `#594139 / 86%` | Supporting text |
| Text tertiary | `--text-tertiary` | `#594139 / 64%` | Metadata, labels |
| Text muted | `--text-muted` | `#594139 / 44%` | Disabled, placeholders |
| Brand primary | `--brand-primary` | `#4F6144` | Leaf actions, secondary CTAs, success |
| Brand accent | `--brand-accent` | `#A73400` | Primary buttons, links, prices |
| Brand warm | `--brand-warm` | `#F0642F` | Highlights, fresh states, super-admin emphasis |
| Clay | `--color-terra` | `#E09B6B` | Soft decorative warmth and low-emphasis badges |
| Border | `--border-soft / mid / strong` | `#8D7168` alphas | Low-noise separation |

**Rules**:
- Primary action text uses `--color-bone` on `--brand-accent`.
- Use `--brand-primary` for calm secondary action, not as a page background.
- Keep blue/purple out of system states; info uses muted leaf.
- Avoid raw hex in components unless working in standalone SVG assets.

## Typography

Fonts are loaded through `next/font/google` in `frontend/src/app/layout.tsx`.

- **Literata** — headlines, wordmark fallback, dialog titles, editorial sections.
- **DM Sans** — body copy, UI, inputs, buttons.
- **JetBrains Mono** — metadata, dates, IDs, tabular numbers, role labels.

Variables: `--font-serif`, `--font-sans`, `--font-mono`.

## Spacing, Radius, Depth

- 4pt base unit. Tokens `--space-1..16`.
- Radius: `sm 4 / md 8 / lg 12 / xl 16 / full`.
- Depth strategy: tonal layers plus very soft clay-tinted ambient shadows.
- Inputs are inset warm off-white (`--input-bg`) with sandy borders.
- Header glass uses white opacity plus `backdrop-filter: blur(20px)`.

## Signature Element

The initials chip remains the reusable brand gesture:

1. Toast icon discs.
2. Success modal icon disc.
3. UserMenu avatar.
4. Users table avatar.
5. Future avatars.

Default chip token: `font-family: var(--font-mono); letter-spacing: 0.04em;
background: var(--brand-accent); color: var(--color-bone);`.

## Logo System

Component: `frontend/src/components/logo.tsx`.

- `variant="mark"`: cabin only.
- `variant="full"`: cabin + Cabanas Coroico wordmark.
- `tone="default"`: light morning surfaces.
- `tone="onForest"`: dark overlays only, using inverse tokens.
- `tone="monochrome"`: currentColor.

The logo is server-rendered SVG inline. Never replace it with `<img src>`.

## Media Hero Legibility

Any text rendered over a CMS/property photo must use the media hero pattern from
`frontend/src/app/globals.css`:

- `.media-hero-scrim` on the image overlay.
- `.media-hero-title` on the main headline.
- `.media-hero-copy` on supporting copy.
- `.media-hero-chip` for availability/status chips over media.
- `.media-hero-secondary` for secondary buttons over media.

Reason: CMS images vary wildly in brightness. A single transparent black overlay
is not enough for all photos. The approved pattern uses a focal radial scrim plus
controlled text shadow, keeping the morning palette while making headlines read
clearly over foliage, brick, sky, and interiors.

## Motion

Defined in `frontend/src/app/globals.css`. Animations express cause-effect and
respect `prefers-reduced-motion`.

| Keyframe | Use |
|---|---|
| `fadeIn` | Dropdowns, calendar range, in-range cells |
| `slideUp` | Card and list entry |
| `slideInRight` | Toasts |
| `dialogIn` | Modals |
| `pulseAccent` | `?fresh=1` highlight |
| `shimmer` | Skeleton loading |

## State Patterns

For network data, pages should explicitly render loading, error, empty, and data
states. Error surfaces use `rgba(186, 26, 26, 0.08)` with a matching soft border.
Success uses leaf alphas. Warning uses warm brown/orange alphas.

## Component Library Reused Across The App

- `<Logo>`
- `<UserMenu placement="header" | "sidebar" collapsed>`
- `<VoucherViewer variant="full" | "thumb" url minioKey>`
- `<ReservationSuccessDialog>`
- `<StaticPageContent slug title lead icon>`
- `<ToastProvider>` + `useToast()`

## Backend Conventions That Affect The UI

- List endpoints return `{ items: [...], total, page?, page_size? }`, not bare arrays.
- IDs are UUIDs and URLs use lowercase UUIDs.
- Static pages: `/cms/pages/{slug}` returns `{ id, slug, content, updated_at? }`.
- Browser-facing MinIO URLs are rewritten with `toBrowserUrl()`.

## CSS Layer Architecture

Tailwind v4 declares `@layer theme, base, components, utilities;`.

- `@layer utilities`: single-property token classes only.
- `@layer components`: multi-property classes like `.btn-*`, `.card`,
  `.input-field`, `.badge-*`.

Multi-property classes belong in `components` so Tailwind utilities can override
padding, background, and spacing safely at call sites.

## What To Never Do

- Do not reintroduce the old dark forest theme as the default.
- Do not add blue/purple SaaS accents.
- Do not use decorative gradient orbs.
- Do not use raw status colors when a semantic token exists.
- Do not ship pages without loading, error, empty, and success/data states.
- Do not place logout as a bare button; it belongs in `UserMenu`.
