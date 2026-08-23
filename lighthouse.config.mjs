export const LIGHTHOUSE_VERSION = '13.4.1';
export const LIGHTHOUSE_RESULTS_DIR = 'test-output/lighthouse';
export const LIGHTHOUSE_CHROME_FLAGS =
  '--no-sandbox --disable-dev-shm-usage --headless=new';

export const LIGHTHOUSE_PAGE_CLASS = Object.freeze({
  PUBLIC: 'public',
  AUTH: 'auth',
  PROTECTED: 'protected',
});

const publicThresholds = Object.freeze({
  performance: Object.freeze({type: 'minScore', value: 0.6}),
  accessibility: Object.freeze({type: 'minScore', value: 0.8}),
  seo: Object.freeze({type: 'minScore', value: 0.8}),
});

const nonPublicThresholds = Object.freeze({
  performance: Object.freeze({type: 'minScore', value: 0.6}),
  accessibility: Object.freeze({type: 'minScore', value: 0.8}),
});

export const LIGHTHOUSE_PAGES = Object.freeze([
  Object.freeze({
    key: 'home',
    pageClass: LIGHTHOUSE_PAGE_CLASS.PUBLIC,
    url: 'http://localhost:5500/',
    runs: 1,
    thresholds: publicThresholds,
  }),
  Object.freeze({
    key: 'about',
    pageClass: LIGHTHOUSE_PAGE_CLASS.PUBLIC,
    url: 'http://localhost:5500/pages/over.html',
    runs: 1,
    thresholds: publicThresholds,
  }),
  Object.freeze({
    key: 'agenda',
    pageClass: LIGHTHOUSE_PAGE_CLASS.PUBLIC,
    url: 'http://localhost:5500/pages/agenda.html',
    runs: 1,
    thresholds: publicThresholds,
  }),
  Object.freeze({
    key: 'media',
    pageClass: LIGHTHOUSE_PAGE_CLASS.PUBLIC,
    url: 'http://localhost:5500/pages/media.html',
    runs: 1,
    thresholds: publicThresholds,
  }),
  Object.freeze({
    key: 'repertoire',
    pageClass: LIGHTHOUSE_PAGE_CLASS.PUBLIC,
    url: 'http://localhost:5500/pages/repertoire.html',
    runs: 3,
    thresholds: Object.freeze({
      ...publicThresholds,
      'cumulative-layout-shift': Object.freeze({
        type: 'maxNumericValue',
        value: 0.1,
      }),
    }),
  }),
  Object.freeze({
    key: 'news',
    pageClass: LIGHTHOUSE_PAGE_CLASS.PUBLIC,
    url: 'http://localhost:5500/pages/nieuws.html',
    runs: 1,
    thresholds: publicThresholds,
  }),
  Object.freeze({
    key: 'news-detail',
    pageClass: LIGHTHOUSE_PAGE_CLASS.PUBLIC,
    url:
      'http://localhost:5500/pages/nieuwsbericht.html' +
      '?slug=spontaan-zingt-tijdens-een-sfeervolle-zomeravond',
    runs: 1,
    thresholds: publicThresholds,
  }),
  Object.freeze({
    key: 'friends',
    pageClass: LIGHTHOUSE_PAGE_CLASS.PUBLIC,
    url: 'http://localhost:5500/pages/vrienden.html',
    runs: 1,
    thresholds: publicThresholds,
  }),
  Object.freeze({
    key: 'contact',
    pageClass: LIGHTHOUSE_PAGE_CLASS.PUBLIC,
    url: 'http://localhost:5500/pages/contact.html',
    runs: 1,
    thresholds: publicThresholds,
  }),

  Object.freeze({
    key: 'login',
    pageClass: LIGHTHOUSE_PAGE_CLASS.AUTH,
    url: 'http://localhost:5500/leden/login.html',
    runs: 1,
    thresholds: nonPublicThresholds,
  }),
  Object.freeze({
    key: 'forgot-password',
    pageClass: LIGHTHOUSE_PAGE_CLASS.AUTH,
    url: 'http://localhost:5500/leden/wachtwoord-vergeten.html',
    runs: 1,
    thresholds: nonPublicThresholds,
  }),
  Object.freeze({
    key: 'reset-password',
    pageClass: LIGHTHOUSE_PAGE_CLASS.AUTH,
    url: 'http://localhost:5500/leden/reset-wachtwoord.html',
    runs: 1,
    thresholds: nonPublicThresholds,
  }),

  Object.freeze({
    key: 'member-dashboard',
    pageClass: LIGHTHOUSE_PAGE_CLASS.PROTECTED,
    url: 'http://localhost:5500/leden/dashboard.html',
    runs: 1,
    thresholds: nonPublicThresholds,
    readiness: Object.freeze({
      selector: '#portal-destinations',
      requiredTables: Object.freeze(['profiles']),
      requiredRpcs: Object.freeze([]),
    }),
  }),
  Object.freeze({
    key: 'member-music',
    pageClass: LIGHTHOUSE_PAGE_CLASS.PROTECTED,
    url: 'http://localhost:5500/leden/muziek.html',
    runs: 1,
    thresholds: nonPublicThresholds,
    readiness: Object.freeze({
      selector: '.song-card',
      requiredTables: Object.freeze([
        'profiles',
        'member_songs',
        'member_song_links',
      ]),
      requiredRpcs: Object.freeze([]),
    }),
  }),
  Object.freeze({
    key: 'member-directory',
    pageClass: LIGHTHOUSE_PAGE_CLASS.PROTECTED,
    url: 'http://localhost:5500/leden/smoelenboek.html',
    runs: 1,
    thresholds: nonPublicThresholds,
    readiness: Object.freeze({
      selector: '.member-directory-card',
      requiredTables: Object.freeze(['profiles']),
      requiredRpcs: Object.freeze(['get_member_directory']),
    }),
  }),
  Object.freeze({
    key: 'admin-members',
    pageClass: LIGHTHOUSE_PAGE_CLASS.PROTECTED,
    url: 'http://localhost:5500/admin/index.html',
    runs: 1,
    thresholds: nonPublicThresholds,
    readiness: Object.freeze({
      selector: '#ledenbeheer-lijst-body tr.ledenbeheer-member-row',
      requiredTables: Object.freeze(['profiles']),
      requiredRpcs: Object.freeze([]),
    }),
  }),
  Object.freeze({
    key: 'admin-portal',
    pageClass: LIGHTHOUSE_PAGE_CLASS.PROTECTED,
    url: 'http://localhost:5500/admin/ledenportaal.html',
    runs: 1,
    thresholds: nonPublicThresholds,
    readiness: Object.freeze({
      selector: '#song-admin-list .portal-beheer-song-card',
      requiredTables: Object.freeze([
        'profiles',
        'member_songs',
        'member_song_links',
        'member_directory',
      ]),
      requiredRpcs: Object.freeze([]),
    }),
  }),
  Object.freeze({
    key: 'admin-report',
    pageClass: LIGHTHOUSE_PAGE_CLASS.PROTECTED,
    url: 'http://localhost:5500/admin/rapportage.html',
    runs: 1,
    thresholds: nonPublicThresholds,
    readiness: Object.freeze({
      selector: '#rapportage-content:not([hidden])',
      requiredTables: Object.freeze(['profiles']),
      requiredRpcs: Object.freeze([]),
      loadedTextSelector: '#rapportage-status-title',
      forbiddenLoadedText: 'wordt geladen',
    }),
  }),
]);