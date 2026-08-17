import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertNoProductionTestData,
  resolveProductionTestDataGuardFixture,
} from '../scripts/build-site.mjs';

const PRODUCTION = Object.freeze({
  environment: 'production',
});

const DEVELOPMENT = Object.freeze({
  environment: 'development',
});

test(
  'Production staat schone CMS-documentmetadata toe',
  () => {
    assert.doesNotThrow(() =>
      assertNoProductionTestData(
        [
          {
            _id: 'homePage-main',
            _type: 'homePage',
          },
          {
            _id: 'aboutPage-main',
            _type: 'aboutPage',
            isTestData: false,
          },
          {
            _id: 'friend-demonstratie-01',
            _type: 'friendItem',
          },
        ],
        PRODUCTION,
      ),
    );
  },
);

test(
  'Production blokkeert isTestData=true',
  () => {
    assert.throws(
      () =>
        assertNoProductionTestData(
          [
            {
              _id: 'contactPage-main',
              _type: 'contactPage',
              isTestData: true,
            },
          ],
          PRODUCTION,
        ),
      (error) =>
        error instanceof Error &&
        error.message.includes(
          'Production-testdata-guard geblokkeerd',
        ) &&
        error.message.includes(
          'contactPage-main',
        ) &&
        error.message.includes(
          'isTestData=true',
        ),
    );
  },
);

test(
  'Production blokkeert documenten met test-* _id',
  () => {
    assert.throws(
      () =>
        assertNoProductionTestData(
          [
            {
              _id: 'test-photoAlbum-01',
              _type: 'photoAlbum',
            },
          ],
          PRODUCTION,
        ),
      (error) =>
        error instanceof Error &&
        error.message.includes(
          'test-photoAlbum-01',
        ) &&
        error.message.includes(
          '_id=test-*',
        ),
    );
  },
);

test(
  'Production blokkeert documenten met *-demo-* _id',
  () => {
    assert.throws(
      () =>
        assertNoProductionTestData(
          [
            {
              _id: 'friend-demo-aurello',
              _type: 'friendItem',
            },
          ],
          PRODUCTION,
        ),
      (error) =>
        error instanceof Error &&
        error.message.includes(
          'friend-demo-aurello',
        ) &&
        error.message.includes(
          '_id=*-demo-*',
        ),
    );
  },
);

test(
  'Development blijft expliciet test- en demodata toestaan',
  () => {
    assert.doesNotThrow(() =>
      assertNoProductionTestData(
        [
          {
            _id: 'contactPage-main',
            _type: 'contactPage',
            isTestData: true,
          },
          {
            _id: 'test-photoAlbum-01',
            _type: 'photoAlbum',
          },
          {
            _id: 'friend-demo-aurello',
            _type: 'friendItem',
          },
        ],
        DEVELOPMENT,
      ),
    );
  },
);
test(
  'guardfixture is toegestaan in lokale synthetische Production-testcontext',
  () => {
    assert.equal(
      resolveProductionTestDataGuardFixture({
        NODE_ENV: 'test',
        VERCEL_ENV: 'production',
        SITE_OUTPUT_DIR:
          'test-output/production-contract/output',
        PRODUCTION_TESTDATA_GUARD_FIXTURE:
          'tests/fixtures/production-testdata-clean.json',
      }),
      'tests/fixtures/production-testdata-clean.json',
    );
  },
);

test(
  'guardfixture faalt dicht buiten NODE_ENV=test',
  () => {
    assert.throws(
      () =>
        resolveProductionTestDataGuardFixture({
          NODE_ENV: 'production',
          SITE_OUTPUT_DIR:
            'test-output/production-contract/output',
          PRODUCTION_TESTDATA_GUARD_FIXTURE:
            'tests/fixtures/production-testdata-clean.json',
        }),
      /uitsluitend toegestaan in een lokale geïsoleerde testcontext/,
    );
  },
);

test(
  'guardfixture faalt dicht in een Vercel-runtime',
  () => {
    assert.throws(
      () =>
        resolveProductionTestDataGuardFixture({
          NODE_ENV: 'test',
          VERCEL: '1',
          VERCEL_ENV: 'production',
          SITE_OUTPUT_DIR:
            'test-output/production-contract/output',
          PRODUCTION_TESTDATA_GUARD_FIXTURE:
            'tests/fixtures/production-testdata-clean.json',
        }),
      /uitsluitend toegestaan in een lokale geïsoleerde testcontext/,
    );
  },
);

test(
  'guardfixture faalt dicht voor normale dist-output',
  () => {
    assert.throws(
      () =>
        resolveProductionTestDataGuardFixture({
          NODE_ENV: 'test',
          SITE_OUTPUT_DIR: 'dist',
          PRODUCTION_TESTDATA_GUARD_FIXTURE:
            'tests/fixtures/production-testdata-clean.json',
        }),
      /uitsluitend toegestaan in een lokale geïsoleerde testcontext/,
    );
  },
);

test(
  'guardfixture weigert ieder ander fixturepad',
  () => {
    assert.throws(
      () =>
        resolveProductionTestDataGuardFixture({
          NODE_ENV: 'test',
          SITE_OUTPUT_DIR:
            'test-output/production-contract/output',
          PRODUCTION_TESTDATA_GUARD_FIXTURE:
            'tests/fixtures/ander-bestand.json',
        }),
      /Ongeldige Production-testdata-guard fixture/,
    );
  },
);
