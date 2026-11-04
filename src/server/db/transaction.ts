import mongoose, { type ClientSession } from 'mongoose';

/** Driver retries transient conflicts; also retry concurrent unique upserts. */
export async function withTransactionRetry(work: (session: ClientSession) => Promise<void>) {
  const session = await mongoose.startSession();
  try {
    for (let attempt = 0; ; attempt++) {
      try { await session.withTransaction(() => work(session)); return; }
      catch (error) {
        if ((error as { code?: number }).code !== 11000 || attempt >= 2) throw error;
      }
    }
  } finally { await session.endSession(); }
}
