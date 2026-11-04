import Link from 'next/link';
import './back-link.css';

/** Explicit destinations also work when a page is opened directly or from email. */
export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link className="navigation-back" href={href}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m12 5-7 7 7 7M5 12h14" /></svg>
    <span>{children}</span>
  </Link>;
}
