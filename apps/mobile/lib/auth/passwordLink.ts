import { ApiError } from '@/lib/api/errors';

export class PasswordLinkRequired extends Error {
  readonly linkToken: string;

  constructor(linkToken: string) {
    super('This email already has a password');
    this.name = 'PasswordLinkRequired';
    this.linkToken = linkToken;
  }
}

export function rethrowPasswordLink(error: unknown): void {
  if (!(error instanceof ApiError) || error.code !== 'password_link_required') {
    return;
  }

  const token = error.data?.linkToken;
  if (typeof token === 'string' && token.length > 0) {
    throw new PasswordLinkRequired(token);
  }
}
