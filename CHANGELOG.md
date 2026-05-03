# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-05-03

Initial public release.

### Added

- `GmailClient` high-level client with pluggable token cache.
- `MemoryTokenCache` default implementation.
- Send: `send`, `draft`, `reply`, low-level `buildRawEmail`.
- Read: `getProfile`, `listMessages`, `getMessage`, `getMessages` (parallel),
  `syncHistory` (history API with cursor-expiry handling).
- Parse: `getBody`, `getHeader`, `findPart` for extracting plain-text from
  multipart MIME trees.
- Encoding: `utf8ToBase64Url`, `base64UrlToUtf8`, `encodeHeaderValue`
  (RFC 2047), `stripHtml`.
- Dual ESM/CJS build with TypeScript declarations.
