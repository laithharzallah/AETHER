import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * Shared renderer for policy documents, so a policy looks the same in the
 * generator preview as it does once saved. A document that reformats between
 * drafting and publication invites the reader to wonder what else changed.
 */
export function PolicyMarkdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h1 className="mb-4 text-2xl font-semibold tracking-tight">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="mt-8 mb-3 text-xl font-semibold tracking-tight">{children}</h2>
        ),
        h3: ({ children }) => <h3 className="mt-6 mb-2 text-lg font-medium">{children}</h3>,
        h4: ({ children }) => <h4 className="mt-4 mb-2 font-medium">{children}</h4>,
        p: ({ children }) => (
          <p className="mb-3 leading-relaxed text-foreground/90">{children}</p>
        ),
        ul: ({ children }) => <ul className="mb-4 list-disc space-y-1 pl-6">{children}</ul>,
        ol: ({ children }) => (
          <ol className="mb-4 list-decimal space-y-1 pl-6">{children}</ol>
        ),
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        blockquote: ({ children }) => (
          <blockquote className="mb-4 border-l-2 border-border pl-4 text-muted-foreground italic">
            {children}
          </blockquote>
        ),
        table: ({ children }) => (
          <div className="my-4 overflow-x-auto">
            <table className="w-full border-collapse text-sm">{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead className="bg-muted/50">{children}</thead>,
        th: ({ children }) => (
          <th className="border border-border/60 px-3 py-2 text-left font-medium">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border border-border/60 px-3 py-2 align-top">{children}</td>
        ),
        hr: () => <hr className="my-6 border-border/60" />,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        code: ({ children }) => (
          <code className="rounded bg-foreground/5 px-1 py-0.5 text-[0.9em]">
            {children}
          </code>
        ),
        a: ({ children, href }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4"
          >
            {children}
          </a>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  )
}
