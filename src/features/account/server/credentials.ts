import { randomBytes } from 'node:crypto';
import { AccountUser } from '@/server/models/AccountUser';
import { AccountRegistration, AccountToken } from '@/server/models/AccountSecurity';
import { withTransactionRetry } from '@/server/db/transaction';
import { hashPassword, validPassword, validEmail, normalizeEmail, normalizeUsername, validUsername, checkPassword } from './password';
import { digest } from './rate-limit';
import { sendAccountEmail } from './email';

export class AccountError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
export const GENERIC_EMAIL_MESSAGE = 'Nếu email hợp lệ và có thể sử dụng chức năng này, hướng dẫn sẽ được gửi tới hộp thư. Kiểm tra cả thư rác.';
export const newToken = () => randomBytes(32).toString('hex');
function requirePassword(password: unknown, confirmation: unknown): asserts password is string {
  if (!validPassword(password)) throw new AccountError('Mật khẩu cần từ 12 đến 128 ký tự.');
  if (password !== confirmation) throw new AccountError('Xác nhận mật khẩu chưa khớp.');
}
function requireToken(token: unknown): asserts token is string {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw new AccountError('Liên kết không hợp lệ hoặc đã hết hạn. Hãy yêu cầu lại.');
}

export async function registerAccount(body: Record<string, unknown>) {
  const email = normalizeEmail(body.email), username = normalizeUsername(body.username);
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!validEmail(email)) throw new AccountError('Email chưa hợp lệ.');
  if (!validUsername(username)) throw new AccountError('Tên đăng nhập cần 3–24 ký tự a-z, 0-9 hoặc _.');
  if (!name || name.length > 24) throw new AccountError('Tên hiển thị cần từ 1 đến 24 ký tự.');
  requirePassword(body.password, body.confirmation);
  if (await AccountUser.exists({ username })) throw new AccountError('Tên đăng nhập đã được sử dụng.');
  const owner = await AccountUser.findOne({ $or: [{ emailNormalized: email }, { email }] }).lean();
  if (owner) { await sendAccountEmail(email, 'existing'); return; }
  const token = newToken();
  await AccountRegistration.findOneAndUpdate({ emailNormalized: email }, { $set: { username, name, passwordHash: await hashPassword(body.password), tokenHash: digest(token), expiresAt: new Date(Date.now() + 86400000) } }, { upsert: true });
  await sendAccountEmail(email, 'verify', token);
}

export async function resendVerification(email: string) {
  const token = newToken();
  const pending = await AccountRegistration.findOneAndUpdate({ emailNormalized: email, expiresAt: { $gt: new Date() } }, { $set: { tokenHash: digest(token), expiresAt: new Date(Date.now() + 86400000) } }, { new: true }).lean();
  if (pending) await sendAccountEmail(email, 'verify', token);
}

export async function confirmRegistration(token: unknown, replacementUsername?: unknown) {
  requireToken(token);
  await withTransactionRetry(async session => {
    const pending = await AccountRegistration.findOne({ tokenHash: digest(token), expiresAt: { $gt: new Date() } }).select('+passwordHash').session(session);
    if (!pending) throw new AccountError('Liên kết không hợp lệ hoặc đã hết hạn. Hãy yêu cầu lại.');
    const username = replacementUsername ? normalizeUsername(replacementUsername) : pending.username;
    if (!validUsername(username)) throw new AccountError('Tên đăng nhập cần 3–24 ký tự a-z, 0-9 hoặc _.');
    if (await AccountUser.exists({ username }).session(session)) throw new AccountError('Tên đăng nhập vừa được sử dụng. Hãy chọn tên khác.');
    if (await AccountUser.exists({ emailNormalized: pending.emailNormalized }).session(session)) throw new AccountError('Không thể tạo tài khoản. Hãy đăng nhập bằng phương thức đang có.');
    await AccountUser.create([{ username, email: pending.emailNormalized, emailNormalized: pending.emailNormalized, emailVerifiedAt: new Date(), name: pending.name, passwordHash: pending.passwordHash, playerId: randomBytes(5).toString('hex'), sessionVersion: 0 }], { session });
    await pending.deleteOne({ session });
  });
}

export async function forgotPassword(email: string) {
  const user = await AccountUser.findOne({ emailNormalized: email, emailVerifiedAt: { $ne: null } }).select('+passwordHash').lean();
  if (!user) return;
  if (!user.passwordHash) { await sendAccountEmail(email, 'google-only'); return; }
  const token = newToken();
  // New requests do not invalidate already delivered links; a successful reset
  // invalidates all links atomically. This prevents an attacker cancelling mail.
  await AccountToken.create({ tokenHash: digest(token), playerId: user.playerId, sessionVersion: user.sessionVersion ?? 0, purpose: 'password-reset', expiresAt: new Date(Date.now() + 1800000) });
  await sendAccountEmail(email, 'reset', token);
}

export async function resetPassword(body: Record<string, unknown>) {
  requireToken(body.token); requirePassword(body.password, body.confirmation);
  const tokenHash = digest(body.token), passwordHash = await hashPassword(body.password);
  let email = '';
  await withTransactionRetry(async session => {
    const token = await AccountToken.findOneAndDelete({ tokenHash, purpose: 'password-reset', expiresAt: { $gt: new Date() } }, { session });
    if (!token) throw new AccountError('Liên kết không hợp lệ hoặc đã hết hạn. Hãy yêu cầu lại.');
    const user = await AccountUser.findOne({ playerId: token.playerId }).select('+passwordHash').session(session);
    if (!user?.passwordHash || !user.emailVerifiedAt || (user.sessionVersion ?? 0) !== token.sessionVersion) throw new AccountError('Liên kết không hợp lệ hoặc đã hết hạn. Hãy yêu cầu lại.');
    user.passwordHash = passwordHash; user.passwordChangedAt = new Date(); user.sessionVersion = (user.sessionVersion ?? 0) + 1;
    await user.save({ session });
    await AccountToken.deleteMany({ playerId: user.playerId }, { session });
    email = user.email;
  });
  // Notification failure must not roll back an already committed password.
  try { await sendAccountEmail(email, 'changed'); } catch { /* User can still log in with the new password. */ }
}

export async function changePassword(playerId: string, version: number, body: Record<string, unknown>) {
  requirePassword(body.password, body.confirmation);
  const user = await AccountUser.findOne({ playerId }).select('+passwordHash').lean();
  const current = typeof body.currentPassword === 'string' && body.currentPassword.length <= 128 ? body.currentPassword : '';
  if (!user || !await checkPassword(user.passwordHash, current)) throw new AccountError('Mật khẩu hiện tại chưa đúng.');
  const passwordHash = await hashPassword(body.password);
  await withTransactionRetry(async session => {
    const updated = await AccountUser.updateOne({ playerId, passwordHash: user.passwordHash, sessionVersion: version }, { $set: { passwordHash, passwordChangedAt: new Date() }, $inc: { sessionVersion: 1 } }, { session });
    if (!updated.modifiedCount) throw new AccountError('Phiên đã thay đổi. Hãy đăng nhập lại.', 401);
    await AccountToken.deleteMany({ playerId }, { session });
  });
  try { await sendAccountEmail(user.email, 'changed'); } catch { /* Password change is already committed. */ }
}

export async function addPassword(playerId: string, version: number, intent: string, body: Record<string, unknown>) {
  requirePassword(body.password, body.confirmation);
  const username = normalizeUsername(body.username);
  if (!validUsername(username)) throw new AccountError('Tên đăng nhập cần 3–24 ký tự a-z, 0-9 hoặc _.');
  const passwordHash = await hashPassword(body.password);
  let email = '';
  await withTransactionRetry(async session => {
    const proof = await AccountToken.findOneAndDelete({ tokenHash: digest(intent), purpose: 'add-password', playerId, sessionVersion: version, expiresAt: { $gt: new Date() }, provedAt: { $gt: new Date(Date.now() - 300000) } }, { session });
    if (!proof) throw new AccountError('Hãy xác thực lại bằng Google trước khi thêm mật khẩu.', 403);
    const user = await AccountUser.findOne({ playerId, sessionVersion: version, passwordHash: { $exists: false }, googleSubject: { $type: 'string' } }).session(session);
    if (!user?.emailVerifiedAt) throw new AccountError('Không thể thêm mật khẩu. Hãy đăng nhập lại.', 403);
    if (await AccountUser.exists({ username }).session(session)) throw new AccountError('Tên đăng nhập đã được sử dụng.');
    user.username = username; user.passwordHash = passwordHash; user.passwordChangedAt = new Date(); user.sessionVersion = version + 1;
    await user.save({ session });
    await AccountToken.deleteMany({ playerId }, { session });
    email = user.email;
  });
  try { await sendAccountEmail(email, 'added'); } catch { /* Password is committed. */ }
}
