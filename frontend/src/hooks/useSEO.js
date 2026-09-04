import { useEffect } from 'react';

const SITE_NAME = 'CarMarket Ghana';
const DEFAULT_DESCRIPTION =
  'Buy and sell verified new and used cars in Ghana. Browse thousands of listings from trusted dealers and private sellers in Accra, Kumasi and beyond.';

const setMeta = (attr, key, content) => {
  if (content == null) return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
};

const setLink = (rel, href) => {
  if (!href) return;
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
};

/**
 * Per-route SEO: document title, meta description, Open Graph and
 * Twitter card tags, canonical URL. Runs on mount/update and cleans
 * nothing up (the next route's hook overwrites the same tags).
 */
const useSEO = ({ title, description, image, type = 'website', canonical }) => {
  useEffect(() => {
    const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} — Buy & Sell Cars in Ghana`;
    const desc = description || DEFAULT_DESCRIPTION;

    document.title = fullTitle;
    setMeta('name', 'description', desc);

    setMeta('property', 'og:title', fullTitle);
    setMeta('property', 'og:description', desc);
    setMeta('property', 'og:type', type);
    setMeta('property', 'og:site_name', SITE_NAME);
    setMeta('property', 'og:url', canonical || window.location.href);
    if (image) setMeta('property', 'og:image', image);

    setMeta('name', 'twitter:card', image ? 'summary_large_image' : 'summary');
    setMeta('name', 'twitter:title', fullTitle);
    setMeta('name', 'twitter:description', desc);
    if (image) setMeta('name', 'twitter:image', image);

    setLink('canonical', canonical || window.location.href);
  }, [title, description, image, type, canonical]);
};

export default useSEO;
export { SITE_NAME, DEFAULT_DESCRIPTION };
