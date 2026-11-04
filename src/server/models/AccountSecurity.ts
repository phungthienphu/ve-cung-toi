import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const registrationSchema = new Schema({
  emailNormalized: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  name: { type: String, required: true },
  passwordHash: { type: String, required: true, select: false },
  tokenHash: { type: String, required: true, unique: true, select: false },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });
registrationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
const tokenSchema = new Schema({
  tokenHash: { type: String, required: true, unique: true, select: false },
  playerId: { type: String, required: true },
  purpose: { type: String, enum: ['password-reset', 'link-google', 'add-password'], required: true },
  sessionVersion: { type: Number, required: true },
  provedAt: { type: Date },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });
tokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
const limitSchema = new Schema({
  key: { type: String, required: true, unique: true },
  count: { type: Number, required: true },
  expiresAt: { type: Date, required: true },
});
limitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
type Registration = InferSchemaType<typeof registrationSchema>;
type Token = InferSchemaType<typeof tokenSchema>;
type Limit = InferSchemaType<typeof limitSchema>;
export const AccountRegistration = (mongoose.models.AccountRegistration as mongoose.Model<Registration> | undefined) ?? mongoose.model<Registration>('AccountRegistration', registrationSchema);
export const AccountToken = (mongoose.models.AccountToken as mongoose.Model<Token> | undefined) ?? mongoose.model<Token>('AccountToken', tokenSchema);
export const AuthRateLimit = (mongoose.models.AuthRateLimit as mongoose.Model<Limit> | undefined) ?? mongoose.model<Limit>('AuthRateLimit', limitSchema);
