export class PasswordAccountLinkRequiredError extends Error {
  readonly code = 'password_link_required';
  readonly linkToken: string;

  constructor(linkToken: string) {
    super('This email already has a password');
    this.name = 'PasswordAccountLinkRequiredError';
    this.linkToken = linkToken;
  }
}
