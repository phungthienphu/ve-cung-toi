export function HomeIcon({ name }: { name: 'users' | 'bot' | 'bell' | 'history' | 'news' | 'game' }) {
  return <svg className="home-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {name === 'users' && <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M16 4.6a3.4 3.4 0 0 1 0 6.8M18.2 14.8c1.8.8 2.9 2.5 3.3 5.2" /></>}
    {name === 'bot' && <><rect x="4" y="8" width="16" height="12" rx="3" /><path d="M12 8V4.5M9 13.5v1M15 13.5v1" /><circle cx="12" cy="3.5" r="1" /></>}
    {name === 'bell' && <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>}
    {name === 'history' && <><path d="M3 11a9 9 0 1 1 2.6 7M3 4v7h7M12 7v5l3 2" /></>}
    {name === 'news' && <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 7h8M8 11h3M8 15h8M8 18h8M14 10h2v2h-2z" /></>}
    {name === 'game' && <><path d="M7 7h10c3 0 5 11 3 12-2 1-5-4-5-4H9s-3 5-5 4C2 18 4 7 7 7Z M7 9v4M5 11h4M16 10h.01M18 12h.01" /></>}
  </svg>;
}
