import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Observer } from 'tailwindcss-intersect';

const IntersectObserver = () => {
  const location = useLocation();

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run observer on route location change
  useEffect(() => {
    // When the location changes, we need to restart the observer
    // to pick up new elements on the page.
    // We use a small timeout to ensure the DOM has updated.
    const timer = setTimeout(() => {
        Observer.restart();
    }, 100);

    return () => clearTimeout(timer);
  }, [location.pathname]);

  return null;
};

export default IntersectObserver;
