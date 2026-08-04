import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const fallback = JSON.parse(
  await readFile(
    new URL("../data/media-fallback.json", import.meta.url),
    "utf8"
  )
);

const expectedImages = [
  "../images/about/over-hero-mannenkoor.jpg",
  "../images/about/over-intro-mannenkoor.jpg",
  "../images/about/over-sfeer-mannenkoor.jpg",
  "../images/repertoire/repertoire-feestelijk.jpg",
  "../images/repertoire/repertoire-dirigent.jpg"
];

test("media fallback albums contain five validated choir photos", () => {
  assert.equal(fallback.photoAlbums.length, 3);

  for (const album of fallback.photoAlbums) {
    assert.equal(
      album.photos.length,
      5,
      `Fallback album ${album.id} must contain five photos`
    );

    assert.equal(
      album.photos[0].imageUrl,
      album.coverImageUrl,
      `Fallback album ${album.id} must start with its cover image`
    );

    const imageUrls = album.photos.map((photo) => photo.imageUrl);

    assert.equal(
      new Set(imageUrls).size,
      5,
      `Fallback album ${album.id} contains duplicate photos`
    );

    assert.deepEqual(
      [...imageUrls].sort(),
      [...expectedImages].sort()
    );

    assert.equal(
      imageUrls.some((url) => url.includes("/images/news/")),
      false
    );

    for (const photo of album.photos) {
      assert.equal(typeof photo.imageUrl, "string");
      assert.ok(photo.imageUrl.length > 0);
      assert.equal(typeof photo.alt, "string");
      assert.ok(photo.alt.length > 0);
      assert.equal(typeof photo.caption, "string");
      assert.ok(photo.caption.length > 0);
    }
  }
});
