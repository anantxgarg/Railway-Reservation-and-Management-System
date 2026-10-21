import { useEffect, useState } from 'react';

// A tiny hash router: #/pnr/1000000016 -> ['pnr', '1000000016']. Hash URLs
// work with Vite's dev server and any static host without server rewrites,
// and links such as a PNR can be bookmarked or shared.

const parse = () => window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);

export function useRoute() {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const onChange = () => setRoute(parse());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export const navigate = (path) => {
  window.location.hash = path.startsWith('/') ? path : `/${path}`;
};
