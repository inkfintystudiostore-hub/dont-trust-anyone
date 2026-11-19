import { describe, it, expect } from 'vitest';
import { isStandaloneMode, isIosUserAgent, getInstallPlatform } from './pwa.js';

describe('pwa helpers', () => {
  it('detects standalone mode via navigator.standalone', () => {
    expect(isStandaloneMode({ navigator: { standalone: true } })).toBe(true);
    expect(isStandaloneMode({ navigator: { standalone: false } })).toBe(false);
  });

  it('detects standalone mode via display-mode media query', () => {
    const winStandalone = {
      navigator: {},
      matchMedia: (q) => ({ matches: q === '(display-mode: standalone)' }),
    };
    const winFullscreen = {
      navigator: {},
      matchMedia: (q) => ({ matches: q === '(display-mode: fullscreen)' }),
    };
    const winBrowser = {
      navigator: {},
      matchMedia: () => ({ matches: false }),
    };
    expect(isStandaloneMode(winStandalone)).toBe(true);
    expect(isStandaloneMode(winFullscreen)).toBe(true);
    expect(isStandaloneMode(winBrowser)).toBe(false);
  });

  it('detects iOS user agents', () => {
    expect(isIosUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe(true);
    expect(isIosUserAgent('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)')).toBe(true);
    expect(isIosUserAgent('Mozilla/5.0 (Linux; Android 14)')).toBe(false);
  });

  it('returns correct install platform', () => {
    expect(getInstallPlatform({ navigator: { standalone: true, userAgent: 'iPhone' } })).toBe('installed');
    expect(getInstallPlatform({ navigator: { userAgent: 'iPhone' }, matchMedia: () => ({ matches: false }) })).toBe('ios');
    expect(getInstallPlatform({ navigator: { userAgent: 'Linux; Android 14' }, matchMedia: () => ({ matches: false }) })).toBe('android');
    expect(getInstallPlatform({ navigator: { userAgent: 'Windows NT 10.0' }, matchMedia: () => ({ matches: false }) })).toBe('desktop');
  });
});
