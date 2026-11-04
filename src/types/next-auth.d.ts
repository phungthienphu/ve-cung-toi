import type { DefaultSession } from 'next-auth';
declare module 'next-auth' {
  interface Session { user: DefaultSession['user'] & { playerId: string; sessionVersion: number; isAdmin?: boolean } }
  interface User { playerId?: string; sessionVersion?: number }
}
