import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

const components: Components = {
    h1: ({ children }) => (
        <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '24px 0 12px', color: 'var(--text-primary)' }}>{children}</h1>
    ),
    h2: ({ children }) => (
        <h2 style={{ fontSize: '19px', fontWeight: 700, margin: '20px 0 10px', color: 'var(--text-primary)' }}>{children}</h2>
    ),
    h3: ({ children }) => (
        <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '16px 0 8px', color: 'var(--text-primary)' }}>{children}</h3>
    ),
    p: ({ children }) => (
        <p style={{ fontSize: '15px', lineHeight: '1.8', color: 'var(--text-secondary)', margin: '0 0 12px' }}>{children}</p>
    ),
    ul: ({ children }) => (
        <ul style={{ margin: '8px 0 12px', paddingLeft: '24px', listStyleType: 'disc' }}>{children}</ul>
    ),
    ol: ({ children }) => (
        <ol style={{ margin: '8px 0 12px', paddingLeft: '24px' }}>{children}</ol>
    ),
    li: ({ children }) => (
        <li style={{ fontSize: '14px', lineHeight: '1.7', color: 'var(--text-secondary)', marginBottom: '4px' }}>{children}</li>
    ),
    strong: ({ children }) => (
        <strong style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{children}</strong>
    ),
    em: ({ children }) => (
        <em style={{ color: 'var(--text-secondary)' }}>{children}</em>
    ),
    blockquote: ({ children }) => (
        <blockquote style={{
            borderLeft: '3px solid var(--primary)',
            paddingLeft: '16px',
            margin: '12px 0',
            color: 'var(--text-secondary)',
            fontStyle: 'italic',
        }}>{children}</blockquote>
    ),
    code: ({ children, className }) => {
        const isBlock = className?.includes('language-');
        if (isBlock) {
            return (
                <pre style={{
                    background: 'var(--bg-tertiary)',
                    borderRadius: '8px',
                    padding: '16px',
                    overflow: 'auto',
                    margin: '12px 0',
                    fontSize: '13px',
                    lineHeight: '1.5',
                }}>
                    <code style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>{children}</code>
                </pre>
            );
        }
        return (
            <code style={{
                background: 'var(--bg-tertiary)',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '13px',
                fontFamily: 'monospace',
                color: 'var(--primary)',
            }}>{children}</code>
        );
    },
    table: ({ children }) => (
        <div style={{ overflow: 'auto', margin: '12px 0' }}>
            <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '14px',
            }}>{children}</table>
        </div>
    ),
    thead: ({ children }) => (
        <thead style={{ borderBottom: '2px solid var(--border)' }}>{children}</thead>
    ),
    th: ({ children }) => (
        <th style={{
            textAlign: 'left',
            padding: '10px 12px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            fontSize: '13px',
        }}>{children}</th>
    ),
    td: ({ children }) => (
        <td style={{
            padding: '8px 12px',
            borderBottom: '1px solid var(--border)',
            color: 'var(--text-secondary)',
        }}>{children}</td>
    ),
    hr: () => (
        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '20px 0' }} />
    ),
};

export default function Markdown({ content }: { content: string }) {
    return (
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
            {content}
        </ReactMarkdown>
    );
}
