import { describe, it, expect, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import useSEO from '../hooks/useSEO';

const metaContent = (key) => {
  const el = document.head.querySelector(`meta[${key}]`);
  return el ? el.getAttribute('content') : null;
};

describe('useSEO', () => {
  afterEach(() => {
    document.head.innerHTML = '';
    document.title = '';
  });

  it('sets the document title with the site suffix', () => {
    renderHook(() => useSEO({ title: 'Test Page' }));
    expect(document.title).toBe('Test Page | CarMarket Ghana');
  });

  it('writes description and Open Graph tags', () => {
    renderHook(() => useSEO({ title: 'A Car', description: 'A nice car', image: 'http://x/car.jpg' }));
    expect(metaContent('name="description"')).toBe('A nice car');
    expect(metaContent('property="og:title"')).toBe('A Car | CarMarket Ghana');
    expect(metaContent('property="og:description"')).toBe('A nice car');
    expect(metaContent('property="og:image"')).toBe('http://x/car.jpg');
    expect(metaContent('name="twitter:card"')).toBe('summary_large_image');
  });

  it('falls back to the default description when none is provided', () => {
    renderHook(() => useSEO({}));
    expect(metaContent('name="description"')).toMatch(/Buy and sell verified/i);
  });

  it('sets a canonical link', () => {
    renderHook(() => useSEO({ title: 'X', canonical: 'https://example.com/x' }));
    const link = document.head.querySelector('link[rel="canonical"]');
    expect(link.getAttribute('href')).toBe('https://example.com/x');
  });
});
