import { describe, expect, it } from 'vitest';
import { siteUrl, siteUrlNotice } from './site';

describe('siteUrl', () => {
  it('defaults to the local demo origin when unset or empty', () => {
    expect(siteUrl({})).toBe('http://localhost:3000');
    expect(siteUrl({ SITE_URL: '' })).toBe('http://localhost:3000');
  });

  it('accepts an http(s) origin, with or without a trailing slash or a port', () => {
    expect(siteUrl({ SITE_URL: 'https://example.com' })).toBe('https://example.com');
    expect(siteUrl({ SITE_URL: 'https://example.com/' })).toBe('https://example.com');
    expect(siteUrl({ SITE_URL: 'http://localhost:3100' })).toBe('http://localhost:3100');
  });

  it.each(['example.com', 'ftp://example.com', 'https://example.com/shop', 'https://example.com?x=1', 'https://example.com#a'])(
    'rejects %s with a message naming SITE_URL and the received value',
    (value) => {
      expect(() => siteUrl({ SITE_URL: value })).toThrow(new RegExp(`^SITE_URL.*${value.replace(/[.?/#]/g, '\\$&')}`));
    },
  );

  it('has a notice for a production build that falls back to localhost', () => {
    expect(siteUrlNotice({ NODE_ENV: 'production' })).toMatch(/^SITE_URL is not set; using http:\/\/localhost:3000/);
  });

  it('has no notice in development or when the value is set', () => {
    expect(siteUrlNotice({ NODE_ENV: 'development' })).toBeNull();
    expect(siteUrlNotice({ NODE_ENV: 'production', SITE_URL: 'https://example.com' })).toBeNull();
  });
});
