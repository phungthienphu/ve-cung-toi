import { communityRead } from '@/features/community/read-api';
export const dynamic = 'force-dynamic';
export const GET = communityRead('contacts');
import { communityWrite } from '@/features/community/write-api';
export const POST = (req: Request) => communityWrite(req, ['request', 'accept', 'remove', 'block', 'unblock', 'report']);
