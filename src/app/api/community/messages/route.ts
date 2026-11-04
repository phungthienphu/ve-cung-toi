import { communityRead } from '@/features/community/read-api';
export const dynamic = 'force-dynamic';
export const GET = communityRead('messages');
import { communityWrite } from '@/features/community/write-api';
export const POST = (req: Request) => communityWrite(req, ['message', 'read']);
