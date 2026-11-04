export function isAdminEmail(email?: string | null) {
  return (process.env.ADMIN_EMAILS ?? 'phuphung123789@gmail.com').split(',').map(s => s.trim().toLowerCase()).filter(Boolean).includes(email?.toLowerCase() ?? '');
}
