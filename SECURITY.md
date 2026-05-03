# Security

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Instead, open a [private security advisory](https://github.com/Logos-Flux/gmail-edge/security/advisories/new)
on this repository, or email the maintainer (see `package.json` for contact).

You will receive a response within a few business days.

## Scope

This package handles OAuth2 credentials and access tokens. Specific concerns:

- **Token caching:** the default `MemoryTokenCache` stores tokens in process
  memory only. If you implement a custom `TokenCache`, ensure storage is
  encrypted at rest and access is restricted.
- **Refresh tokens:** never ship refresh tokens to browser clients. They
  grant indefinite access to the user's Gmail.
- **OAuth scopes:** request the narrowest scopes you need
  (`gmail.send` alone if you don't read mail).

## Out of scope

- Issues with Gmail itself or the Google OAuth service.
- Vulnerabilities in `googleapis`, which this package replaces.
