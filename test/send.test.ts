import { describe, expect, test } from 'bun:test';
import { base64UrlToUtf8 } from '../src/encode';
import { buildRawEmail } from '../src/send';

function decodeRaw(raw: string): string {
  return base64UrlToUtf8(raw);
}

describe('buildRawEmail', () => {
  test('basic ASCII message', () => {
    const raw = buildRawEmail({ to: 'a@b.c', subject: 'Hi', body: 'Hello' }, 'me@example.com');
    const decoded = decodeRaw(raw);
    expect(decoded).toContain('From: me@example.com');
    expect(decoded).toContain('To: a@b.c');
    expect(decoded).toContain('Subject: Hi');
    expect(decoded).toContain('Content-Type: text/plain; charset=utf-8');
  });

  test('UTF-8 subject is RFC 2047 encoded', () => {
    const raw = buildRawEmail({ to: 'a@b.c', subject: 'Café ☕', body: 'x' }, 'me@example.com');
    const decoded = decodeRaw(raw);
    expect(decoded).toMatch(/Subject: =\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=/);
    expect(decoded).not.toContain('Café');
  });

  test('cc, bcc, replyTo, threading headers', () => {
    const raw = buildRawEmail(
      {
        to: ['a@b.c', 'd@e.f'],
        subject: 'Re: x',
        body: 'reply',
        cc: 'cc@x.com',
        bcc: ['bcc1@x.com', 'bcc2@x.com'],
        replyTo: 'reply@x.com',
        inReplyTo: '<original@mail>',
      },
      'me@example.com',
    );
    const decoded = decodeRaw(raw);
    expect(decoded).toContain('To: a@b.c, d@e.f');
    expect(decoded).toContain('Cc: cc@x.com');
    expect(decoded).toContain('Bcc: bcc1@x.com, bcc2@x.com');
    expect(decoded).toContain('Reply-To: reply@x.com');
    expect(decoded).toContain('In-Reply-To: <original@mail>');
    expect(decoded).toContain('References: <original@mail>');
  });

  test('HTML mode sets correct content-type', () => {
    const raw = buildRawEmail(
      { to: 'a@b.c', subject: 'x', body: '<p>hi</p>', isHtml: true },
      'me@example.com',
    );
    const decoded = decodeRaw(raw);
    expect(decoded).toContain('Content-Type: text/html; charset=utf-8');
  });

  test('emoji body round-trips', () => {
    const original = 'Hello 🌍 from the edge';
    const raw = buildRawEmail({ to: 'a@b.c', subject: 'x', body: original }, 'me@example.com');
    const decoded = decodeRaw(raw);
    // Body is base64-encoded inside the message; pull it out and decode
    const bodyB64 = decoded.split('\r\n\r\n')[1];
    const bodyBytes = Uint8Array.from(atob(bodyB64), (c) => c.charCodeAt(0));
    const body = new TextDecoder().decode(bodyBytes);
    expect(body).toBe(original);
  });
});
