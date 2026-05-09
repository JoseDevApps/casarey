import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { ArrowRight, FileText } from 'lucide-react'

interface CmsStaticPage {
  slug: string
  content: string
  updated_at?: string
}

interface StaticPageContentProps {
  slug: 'terms' | 'privacy' | 'contact'
  title: string
  /** Optional one-line lead under the title, before the body. */
  lead?: string
  icon?: LucideIcon
}

async function fetchPage(slug: string): Promise<CmsStaticPage | null> {
  try {
    const base = process.env.BACKEND_URL || 'http://localhost:8100'
    const res = await fetch(`${base}/cms/pages/${slug}`, {
      next: { revalidate: 300, tags: [`cms:${slug}`] },
    })
    if (!res.ok) return null
    return (await res.json()) as CmsStaticPage
  } catch {
    return null
  }
}

/**
 * Renders the body. The CMS stores plain text — we honor double newlines
 * as paragraph breaks and leave single newlines as `<br/>`. No markdown
 * parsing yet (would require a runtime dep). Lines starting with `# ` are
 * treated as section subtitles to give the super admin minimal hierarchy.
 */
function renderBody(content: string) {
  const blocks = content.replace(/\r\n/g, '\n').split(/\n{2,}/).map((b) => b.trim()).filter(Boolean)
  return blocks.map((block, i) => {
    if (block.startsWith('# ')) {
      return (
        <h2
          key={i}
          className="font-serif text-xl mt-10 mb-3"
          style={{ color: 'var(--text-primary)' }}
        >
          {block.slice(2).trim()}
        </h2>
      )
    }
    return (
      <p
        key={i}
        className="leading-relaxed text-[15px] whitespace-pre-line"
        style={{ color: 'var(--text-secondary)' }}
      >
        {block}
      </p>
    )
  })
}

export async function StaticPageContent({
  slug,
  title,
  lead,
  icon: Icon = FileText,
}: StaticPageContentProps) {
  const page = await fetchPage(slug)

  return (
    <article className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
      {/* Eyebrow + title */}
      <div className="mb-10">
        <span
          className="inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.18em] mb-4"
          style={{ color: 'var(--text-tertiary)' }}
        >
          <Icon size={13} style={{ color: 'var(--brand-accent)' }} />
          Cabañas Coroico
        </span>
        <h1
          className="font-serif text-4xl sm:text-5xl font-bold leading-tight"
          style={{ color: 'var(--text-primary)' }}
        >
          {title}
        </h1>
        {lead && (
          <p
            className="text-base mt-3 max-w-xl"
            style={{ color: 'var(--text-secondary)' }}
          >
            {lead}
          </p>
        )}
      </div>

      {/* Body */}
      <div
        className="rounded-2xl px-6 sm:px-10 py-10"
        style={{
          background: 'var(--surface-1)',
          border: '1px solid var(--border-soft)',
        }}
      >
        {page && page.content?.trim() ? (
          <div className="flex flex-col gap-5">{renderBody(page.content)}</div>
        ) : (
          <div className="text-center py-10">
            <p
              className="font-serif text-lg mb-2"
              style={{ color: 'var(--text-primary)' }}
            >
              Aún estamos redactando esta página
            </p>
            <p
              className="text-sm mb-6 max-w-md mx-auto"
              style={{ color: 'var(--text-secondary)' }}
            >
              Mientras tanto puedes seguir explorando las cabañas o escribirnos
              directamente — respondemos en menos de 24 horas.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/properties"
                className="inline-flex items-center justify-center gap-2 text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
                style={{
                  background: 'var(--brand-accent)',
                  color: 'var(--color-bone, rgb(249,244,230))',
                }}
              >
                Ver cabañas
                <ArrowRight size={14} />
              </Link>
              {slug !== 'contact' && (
                <Link
                  href="/contact"
                  className="btn-ghost inline-flex items-center justify-center gap-2 text-sm font-medium px-5 py-2.5 rounded-lg"
                >
                  Contacto
                </Link>
              )}
            </div>
          </div>
        )}

        {page?.updated_at && page.content?.trim() && (
          <p
            className="text-xs font-mono mt-10 pt-6"
            style={{
              color: 'var(--text-muted)',
              borderTop: '1px solid var(--border-soft)',
            }}
          >
            Última actualización · {new Date(page.updated_at).toLocaleDateString('es-BO', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        )}
      </div>
    </article>
  )
}
