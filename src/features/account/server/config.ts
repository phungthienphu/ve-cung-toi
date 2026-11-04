export const googleLoginEnabled = !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET && process.env.AUTH_SECRET);
export const emailLoginEnabled = process.env.AUTH_EMAIL_ENABLED === 'true' && !!(process.env.AUTH_SECRET && process.env.RESEND_API_KEY && process.env.AUTH_EMAIL_FROM && process.env.AUTH_PUBLIC_ORIGIN);
export const authEnabled = googleLoginEnabled || emailLoginEnabled;
