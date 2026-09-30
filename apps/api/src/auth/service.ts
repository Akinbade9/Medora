import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { isValidObjectId } from 'mongoose';
import type { PublicUser, Role } from '@medora/shared-types';
import type { AuthConfig } from './config.js';
import { AuthSession, User, publicUser } from './models.js';
import { getDummyHash, hashPassword, verifyPassword } from './password.js';
import { AuthError } from './validation.js';

const issuer = 'medora-api';
const audience = 'medora-clients';
const digest = (value: string) =>
  createHash('sha256').update(value).digest('hex');
const opaqueToken = (id: string) =>
  `${id}.${randomBytes(32).toString('base64url')}`;
export interface Principal {
  user: PublicUser;
  sessionId: string;
}
export class AuthService {
  constructor(readonly config: AuthConfig) {}
  private async access(user: PublicUser, sessionId: string) {
    return new SignJWT({ sid: sessionId, purpose: 'access' })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(user.id)
      .setIssuer(issuer)
      .setAudience(audience)
      .setIssuedAt()
      .setExpirationTime(`${this.config.accessSeconds}s`)
      .sign(this.config.jwtKey);
  }
  private async result(
    user: PublicUser,
    sessionId: string,
    refreshToken: string,
  ) {
    return {
      user,
      accessToken: await this.access(user, sessionId),
      expiresIn: this.config.accessSeconds,
      refreshToken,
    };
  }
  private async session(user: PublicUser) {
    const id = randomUUID();
    const token = opaqueToken(id);
    await AuthSession.create({
      _id: id,
      userId: user.id,
      refreshHash: digest(token),
      expiresAt: new Date(Date.now() + this.config.refreshSeconds * 1000),
    });
    return this.result(user, id, token);
  }
  async register(input: {
    email: string;
    password: string;
    displayName: string;
  }) {
    const passwordHash = await hashPassword(input.password);
    try {
      const user = await User.create({
        email: input.email,
        displayName: input.displayName,
        passwordHash,
        role: 'PATIENT',
      });
      return await this.session(publicUser(user));
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 11000
      )
        throw new AuthError(409, 'An account with that email already exists.');
      throw error;
    }
  }
  async login(input: { email: string; password: string }) {
    const user = await User.findOne({ email: input.email }).select(
      '+passwordHash',
    );
    const valid = await verifyPassword(
      input.password,
      user?.passwordHash ?? (await getDummyHash()),
    );
    if (!user || !valid || !user.active)
      throw new AuthError(401, 'Invalid email or password.');
    return this.session(publicUser(user));
  }
  async refresh(token: string | undefined) {
    if (!token || !/^[a-f0-9-]{36}\.[A-Za-z0-9_-]{43}$/.test(token))
      throw new AuthError(401, 'Please sign in again.');
    const id = token.split('.')[0]!;
    const oldHash = digest(token);
    const next = opaqueToken(id);
    // Compare-and-swap makes each refresh token usable only once, including concurrent requests.
    const session = await AuthSession.findOneAndUpdate(
      {
        _id: id,
        refreshHash: oldHash,
        revoked: false,
        expiresAt: { $gt: new Date() },
      },
      { $set: { refreshHash: digest(next) }, $push: { usedHashes: oldHash } },
      { returnDocument: 'after' },
    );
    if (!session) {
      // Only an actually consumed token revokes the family; a guessed token cannot do so.
      await AuthSession.updateOne(
        { _id: id, usedHashes: oldHash },
        { $set: { revoked: true } },
      );
      throw new AuthError(401, 'Please sign in again.');
    }
    const user = await User.findById(session.userId);
    if (!user?.active) {
      await AuthSession.updateOne({ _id: id }, { $set: { revoked: true } });
      throw new AuthError(401, 'Please sign in again.');
    }
    return this.result(publicUser(user), id, next);
  }
  async logout(token: string | undefined) {
    if (!token) return;
    const id = token.split('.')[0];
    if (!id) return;
    const hash = digest(token);
    await AuthSession.updateOne(
      { _id: id, $or: [{ refreshHash: hash }, { usedHashes: hash }] },
      { $set: { revoked: true } },
    );
  }
  async authenticate(token: string): Promise<Principal> {
    let payload;
    try {
      ({ payload } = await jwtVerify(token, this.config.jwtKey, {
        algorithms: ['HS256'],
        requiredClaims: ['sub', 'sid', 'exp', 'iat', 'purpose'],
        issuer,
        audience,
        typ: 'JWT',
      }));
    } catch {
      throw new AuthError(401, 'Please sign in again.');
    }
    if (
      payload.purpose !== 'access' ||
      typeof payload.sid !== 'string' ||
      !payload.sub ||
      !isValidObjectId(payload.sub)
    )
      throw new AuthError(401, 'Please sign in again.');
    const session = await AuthSession.findOne({
      _id: payload.sid,
      userId: payload.sub,
      revoked: false,
      expiresAt: { $gt: new Date() },
    });
    const user = session && (await User.findById(payload.sub));
    if (!user?.active) throw new AuthError(401, 'Please sign in again.');
    // The database is authoritative for role and account state, never request data/JWT role claims.
    return { user: publicUser(user), sessionId: payload.sid };
  }
}
export function assertRole(principal: Principal, allowed: readonly Role[]) {
  if (!allowed.includes(principal.user.role))
    throw new AuthError(403, 'You do not have access to this resource.');
}
export function assertOwner(
  principal: Principal,
  ownerId: string,
  bypassRoles: readonly Role[] = [],
) {
  if (
    principal.user.id !== ownerId &&
    !bypassRoles.includes(principal.user.role)
  )
    throw new AuthError(403, 'You do not have access to this resource.');
}
