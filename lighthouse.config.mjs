export const LIGHTHOUSE_VERSION = '13.4.1';
export const LIGHTHOUSE_RESULTS_DIR = 'test-output/lighthouse';
export const LIGHTHOUSE_CHROME_FLAGS =
  '--no-sandbox --disable-dev-shm-usage --headless=new';

const sharedThresholds = Object.freeze({
  performance: Object.freeze({type: 'minScore', value: 0.6}),
  accessibility: Object.freeze({type: 'minScore', value: 0.8}),
  seo: Object.freeze({type: 'minScore', value: 0.8}),
});

export const LIGHTHOUSE_PAGES = Object.freeze([
  Object.freeze({
    key: 'home',
    url: 'http://localhost:5500/',
    runs: 1,
    thresholds: sharedThresholds,
  }),
  Object.freeze({
    key: 'media',
    url: 'http://localhost:5500/pages/media.html',
    runs: 1,
    thresholds: sharedThresholds,
  }),
  Object.freeze({
    key: 'repertoire',
    url: 'http://localhost:5500/pages/repertoire.html',
    runs: 3,
    thresholds: Object.freeze({
      ...sharedThresholds,
      'cumulative-layout-shift': Object.freeze({
        type: 'maxNumericValue',
        value: 0.1,
      }),
    }),
  }),
]);
