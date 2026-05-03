import { describe, expect, test } from 'bun:test';
import { base64UrlToUtf8, encodeHeaderValue, stripHtml, utf8ToBase64Url } from '../src/encode';

describe('utf8ToBase64Url', () => {
  test('encodes ASCII', () => {
    expect(utf8ToBase64Url('hello')).toBe('aGVsbG8');
  });

  test('encodes emoji', () => {
    const encoded = utf8ToBase64Url('Café ☕');
    expect(base64UrlToUtf8(encoded)).toBe('Café ☕');
  });

  test('encodes CJK', () => {
    const encoded = utf8ToBase64Url('こんにちは');
    expect(base64UrlToUtf8(encoded)).toBe('こんにちは');
  });

  test('uses base64url alphabet', () => {
    // Inputs that produce + and / in standard base64
    const encoded = utf8ToBase64Url('subjects?');
    expect(encoded).not.toContain('+');
    expect(encoded).not.toContain('/');
    expect(encoded).not.toContain('=');
  });
});

describe('encodeHeaderValue', () => {
  test('passes through pure ASCII', () => {
    expect(encodeHeaderValue('Hello World')).toBe('Hello World');
  });

  test('RFC 2047 encodes non-ASCII', () => {
    const encoded = encodeHeaderValue('Café ☕');
    expect(encoded).toMatch(/^=\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=$/);
  });

  test('round-trips emoji', () => {
    const original = '🎉 Launch day';
    const encoded = encodeHeaderValue(original);
    // Extract base64 between =?UTF-8?B? and ?=
    const match = encoded.match(/^=\?UTF-8\?B\?([A-Za-z0-9+/=]+)\?=$/);
    expect(match).not.toBeNull();
    const b64 = match![1];
    const decoded = new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
    expect(decoded).toBe(original);
  });
});

describe('stripHtml', () => {
  test('removes tags', () => {
    expect(stripHtml('<p>Hello <b>world</b></p>')).toBe('Hello world');
  });

  test('preserves paragraph breaks', () => {
    expect(stripHtml('<p>One</p><p>Two</p>')).toMatch(/One\s+Two/);
  });

  test('decodes basic entities', () => {
    expect(stripHtml('Tom &amp; Jerry')).toBe('Tom & Jerry');
    expect(stripHtml('&lt;tag&gt;')).toBe('<tag>');
  });
});
