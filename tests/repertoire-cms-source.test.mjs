import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

import {
  normalizeRepertoireContent,
  renderRepertoirePage,
} from '../scripts/build-site.mjs';

test(
  'CMS-repertoire behoudt gepubliceerde itemtitel via echte referenties',
  async () => {
    const template = await readFile(
      'build/repertoire.template.html',
      'utf8',
    );

    const fixture = JSON.parse(
      await readFile(
        'tests/fixtures/repertoire-cms.json',
        'utf8',
      ),
    );

    const rawContent = JSON.parse(
      JSON.stringify(fixture.result),
    );

    const marker =
      '[TEST] [CMS-REGRESSION] Avond';

    const avond = rawContent.items.find(
      (item) =>
        item.id === 'test-repertoire-avond',
    );

    assert.ok(
      avond,
      'Fixture mist test-repertoire-avond',
    );

    avond.title = marker;

    const content =
      normalizeRepertoireContent(rawContent);

    const html = renderRepertoirePage(
      template,
      content,
      'cms',
    );

    assert.match(
      html,
      /document\.documentElement\.dataset\.repertoireSource="cms"/,
    );

    const markerCount =
      html.split(marker).length - 1;

    assert.ok(
      markerCount >= 2,
      `Verwacht marker via wereld/selectie, gevonden: ${markerCount}`,
    );

    assert.match(
      html,
      /\[TEST\] Warm/,
    );

    assert.match(
      html,
      /\[TEST\] Een greep uit ons repertoire/,
    );

    assert.doesNotMatch(
      html,
      /Warm en Nederlandstalig/,
    );
  },
);