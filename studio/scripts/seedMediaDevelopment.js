import {createHash} from 'node:crypto'
import {createReadStream, readFileSync} from 'node:fs'
import {basename, resolve} from 'node:path'
import {getCliClient} from 'sanity/cli'

const API_VERSION = '2026-07-06'
const EXPECTED_DATASET = 'development'

const client = getCliClient({apiVersion: API_VERSION})

const LEGACY_DOCUMENT_IDS = [
  'test-mediaPage-main',
  'photoAlbum-zomeravondconcert',
  'photoAlbum-kerstconcert',
  'photoAlbum-repetities',
]

function getFileSha1(filePath) {
  return createHash('sha1')
    .update(readFileSync(filePath))
    .digest('hex')
}

async function getOrUploadImage(relativePath) {
  const filePath = resolve(process.cwd(), relativePath)
  const filename = basename(filePath)
  const sha1hash = getFileSha1(filePath)

  const existingAssetId = await client.fetch(
    `*[
      _type == "sanity.imageAsset" &&
      sha1hash == $sha1hash
    ][0]._id`,
    {sha1hash}
  )

  if (existingAssetId) {
    console.log(`Afbeelding hergebruikt: ${filename}`)
    return existingAssetId
  }

  const asset = await client.assets.upload(
    'image',
    createReadStream(filePath),
    {filename}
  )

  console.log(`Afbeelding geüpload: ${filename}`)
  return asset._id
}

function createTestWaveBuffer({
  frequency,
  durationSeconds = 4,
  sampleRate = 22050,
}) {
  const sampleCount = Math.floor(sampleRate * durationSeconds)
  const bytesPerSample = 2
  const dataSize = sampleCount * bytesPerSample
  const buffer = Buffer.alloc(44 + dataSize)

  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * bytesPerSample, 28)
  buffer.writeUInt16LE(bytesPerSample, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataSize, 40)

  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / sampleRate
    const fadeIn = Math.min(1, index / (sampleRate * 0.12))
    const fadeOut = Math.min(
      1,
      (sampleCount - index) / (sampleRate * 0.2)
    )
    const envelope = Math.min(fadeIn, fadeOut)
    const sample =
      Math.sin(2 * Math.PI * frequency * time) *
      envelope *
      0.22

    buffer.writeInt16LE(
      Math.round(sample * 32767),
      44 + index * bytesPerSample
    )
  }

  return buffer
}

async function getOrUploadTestAudio({
  filename,
  frequency,
}) {
  const existingAssetId = await client.fetch(
    `*[
      _type == "sanity.fileAsset" &&
      originalFilename == $filename
    ][0]._id`,
    {filename}
  )

  if (existingAssetId) {
    console.log(`Testaudio hergebruikt: ${filename}`)
    return existingAssetId
  }

  const asset = await client.assets.upload(
    'file',
    createTestWaveBuffer({frequency}),
    {
      filename,
      contentType: 'audio/wav',
    }
  )

  console.log(`Testaudio geüpload: ${filename}`)
  return asset._id
}

function assetReference(assetId) {
  return {
    _type: 'reference',
    _ref: assetId,
  }
}

function imageReference(assetId) {
  return {
    _type: 'image',
    asset: assetReference(assetId),
  }
}

function fileReference(assetId) {
  return {
    _type: 'file',
    asset: assetReference(assetId),
  }
}

function albumPhoto(key, assetId, alt, caption) {
  return {
    _key: key,
    _type: 'albumPhoto',
    image: imageReference(assetId),
    alt,
    caption,
  }
}

async function main() {
  const dataset = client.config().dataset

  if (dataset !== EXPECTED_DATASET) {
    throw new Error(
      `Seed afgebroken: verwacht dataset "${EXPECTED_DATASET}", ` +
      `maar CLI gebruikt "${dataset}".`
    )
  }

  const heroAssetId = await getOrUploadImage(
    '../images/media/beeld-en-geluid-hero.jpg'
  )
  const zomerAssetId = await getOrUploadImage(
    '../images/media/demo-zomerconcert.jpg'
  )
  const repetitieAssetId = await getOrUploadImage(
    '../images/media/demo-repetitie.jpg'
  )
  const voorjaarAssetId = await getOrUploadImage(
    '../images/media/demo-voorjaarsoptreden.jpg'
  )

  const audioHighAssetId = await getOrUploadTestAudio({
    filename: 'test-media-audio-hoge-toon.wav',
    frequency: 440,
  })
  const audioLowAssetId = await getOrUploadTestAudio({
    filename: 'test-media-audio-lage-toon.wav',
    frequency: 220,
  })

  const documents = [
    {
      _id: 'mediaPage-main',
      _type: 'mediaPage',
      isTestData: true,
      title: '[TEST] Beeld en Geluid',
      heroTitle: 'Beeld en Geluid',
      heroSubtitle:
        'Beleef Spontaan in beeld, geluid en video. Kijk, luister en geniet mee.',
      heroImage: imageReference(heroAssetId),
      heroImageAlt:
        'Testafbeelding met Zanggroep Spontaan en verwijzingen naar fotografie, muziek en video.',
      introTitle: '[TEST] Beleef onze muziek opnieuw',
      introText:
        'Op deze pagina vind je foto’s, muziek en video’s van Zanggroep Spontaan. ' +
        'Van sfeervolle concertmomenten tot prachtige opnamen van onze muziek. ' +
        'Herbeleef onze mooiste momenten en geniet mee. [TESTINHOUD]',
      ctaEyebrow: '[TEST] Zelf ook meebeleven?',
      ctaTitle: 'Kom luisteren bij Spontaan',
      ctaText:
        'Dit is herkenbare testinhoud en wordt voor oplevering verwijderd.',
      primaryButtonLabel: 'Bekijk de agenda',
      primaryButtonLink: './agenda.html',
      secondaryButtonLabel: 'Kom kennismaken',
      secondaryButtonLink: './contact.html',
    },
    {
      _id: 'test-photoAlbum-zomeravondconcert',
      _type: 'photoAlbum',
      title: '[TEST] Zomeravondconcert',
      eventDate: '2024-06-21',
      summary:
        'Herkenbaar testalbum voor galerij- en CMS-controles.',
      coverImage: imageReference(zomerAssetId),
      coverImageAlt:
        'Testafbeelding van Zanggroep Spontaan tijdens een concert.',
      photos: [
        albumPhoto(
          'test-zomer-01',
          zomerAssetId,
          'Testfoto van Zanggroep Spontaan tijdens een concert.',
          '[TEST] Eerste foto uit het testalbum.'
        ),
        albumPhoto(
          'test-zomer-02',
          repetitieAssetId,
          'Testfoto van leden van Zanggroep Spontaan.',
          '[TEST] Tweede foto uit het testalbum.'
        ),
        albumPhoto(
          'test-zomer-03',
          voorjaarAssetId,
          'Testfoto van Zanggroep Spontaan tijdens een optreden.',
          '[TEST] Derde foto uit het testalbum.'
        ),
      ],
      isFeatured: true,
      isVisible: true,
    },
    {
      _id: 'test-photoAlbum-kerstconcert',
      _type: 'photoAlbum',
      title: '[TEST] Kerstconcert',
      eventDate: '2023-12-17',
      summary:
        'Tweede zichtbaar testalbum voor overzichtscontroles.',
      coverImage: imageReference(repetitieAssetId),
      coverImageAlt:
        'Testafbeelding van Zanggroep Spontaan tijdens een concert.',
      photos: [
        albumPhoto(
          'test-kerst-01',
          repetitieAssetId,
          'Testfoto tijdens een kerstconcert.',
          '[TEST] Eerste kerstconcertfoto.'
        ),
        albumPhoto(
          'test-kerst-02',
          voorjaarAssetId,
          'Testfoto van een gezamenlijk optreden.',
          '[TEST] Tweede kerstconcertfoto.'
        ),
      ],
      isFeatured: false,
      isVisible: true,
    },
    {
      _id: 'test-photoAlbum-repetitie',
      _type: 'photoAlbum',
      title: '[TEST] Repetitie',
      eventDate: '2023-09-04',
      summary:
        'Derde zichtbaar testalbum voor responsive controles.',
      coverImage: imageReference(voorjaarAssetId),
      coverImageAlt:
        'Testafbeelding van Zanggroep Spontaan tijdens een repetitie.',
      photos: [
        albumPhoto(
          'test-repetitie-01',
          voorjaarAssetId,
          'Testfoto van een repetitie.',
          '[TEST] Repetitiefoto.'
        ),
      ],
      isFeatured: false,
      isVisible: true,
    },
    {
      _id: 'test-photoAlbum-voorjaarsoptreden',
      _type: 'photoAlbum',
      title: '[TEST] Voorjaarsoptreden',
      eventDate: '2023-05-14',
      summary:
        'Vierde zichtbaar testalbum voor raster-, carrousel- en responsive controles.',
      coverImage: imageReference(zomerAssetId),
      coverImageAlt:
        'Testafbeelding van Zanggroep Spontaan tijdens een voorjaarsoptreden.',
      photos: [
        albumPhoto(
          'test-voorjaar-01',
          zomerAssetId,
          'Testfoto van Zanggroep Spontaan tijdens een voorjaarsoptreden.',
          '[TEST] Eerste foto van het voorjaarsoptreden.'
        ),
        albumPhoto(
          'test-voorjaar-02',
          repetitieAssetId,
          'Testfoto van leden van Zanggroep Spontaan tijdens het zingen.',
          '[TEST] Tweede foto van het voorjaarsoptreden.'
        ),
      ],
      isFeatured: false,
      isVisible: true,
    },    {
      _id: 'test-photoAlbum-verborgen',
      _type: 'photoAlbum',
      title: '[TEST] Verborgen fotoalbum',
      eventDate: '2023-01-01',
      summary:
        'Dit album mag niet op de publieke website verschijnen.',
      coverImage: imageReference(zomerAssetId),
      coverImageAlt: 'Verborgen testafbeelding.',
      photos: [
        albumPhoto(
          'test-hidden-photo',
          zomerAssetId,
          'Verborgen testfoto.',
          '[TEST] Deze foto hoort niet zichtbaar te zijn.'
        ),
      ],
      isFeatured: false,
      isVisible: false,
    },
    {
      _id: 'test-audioItem-hoge-toon',
      _type: 'audioItem',
      title: '[TEST] Hoge testtoon',
      recordedAt: '2024-05-01',
      summary:
        'Korte gegenereerde testaudio voor bediening en toegankelijkheid.',
      audioFile: fileReference(audioHighAssetId),
      isFeatured: false,
      isVisible: true,
    },
    {
      _id: 'test-audioItem-lage-toon',
      _type: 'audioItem',
      title: '[TEST] Lage testtoon',
      recordedAt: '2024-04-01',
      summary:
        'Tweede testaudio om pauzeren van andere spelers te controleren.',
      audioFile: fileReference(audioLowAssetId),
      isFeatured: false,
      isVisible: true,
    },
    {
      _id: 'test-audioItem-verborgen',
      _type: 'audioItem',
      title: '[TEST] Verborgen audio',
      recordedAt: '2024-03-01',
      summary:
        'Deze testaudio mag niet op de publieke website verschijnen.',
      audioFile: fileReference(audioLowAssetId),
      isFeatured: false,
      isVisible: false,
    },
    {
      _id: 'test-videoItem-eerste',
      _type: 'videoItem',
      title: '[TEST] Voorbeeldvideo één',
      recordedAt: '2024-06-01',
      summary:
        'Testvideo voor veilige uitgestelde YouTube-weergave.',
      youtubeUrl: 'https://www.youtube.com/watch?v=M7lc1UVf-VE',
      thumbnail: imageReference(zomerAssetId),
      thumbnailAlt:
        'Testvoorbeeldafbeelding voor de eerste video.',
      isFeatured: false,
      isVisible: true,
    },
    {
      _id: 'test-videoItem-tweede',
      _type: 'videoItem',
      title: '[TEST] Voorbeeldvideo twee',
      recordedAt: '2024-05-15',
      summary:
        'Tweede testvideo voor raster- en responsive controles.',
      youtubeUrl: 'https://youtu.be/M7lc1UVf-VE',
      thumbnail: imageReference(repetitieAssetId),
      thumbnailAlt:
        'Testvoorbeeldafbeelding voor de tweede video.',
      isFeatured: false,
      isVisible: true,
    },
    {
      _id: 'test-videoItem-verborgen',
      _type: 'videoItem',
      title: '[TEST] Verborgen video',
      recordedAt: '2024-01-01',
      summary:
        'Deze testvideo mag niet op de publieke website verschijnen.',
      youtubeUrl: 'https://www.youtube.com/watch?v=M7lc1UVf-VE',
      thumbnail: imageReference(voorjaarAssetId),
      thumbnailAlt:
        'Verborgen testvoorbeeldafbeelding.',
      isFeatured: false,
      isVisible: false,
    },
  ]

  const transaction = client.transaction()

  LEGACY_DOCUMENT_IDS.forEach((documentId) => {
    transaction.delete(documentId)
  })

  documents.forEach((document) => {
    transaction.createOrReplace(document)
  })

  await transaction.commit()

  const counts = await client.fetch(`{
    "testDocuments": count(*[_id match "test-*"]),
    "visiblePhotoAlbums": count(*[
      _type == "photoAlbum" && isVisible == true
    ]),
    "visibleAudioItems": count(*[
      _type == "audioItem" && isVisible == true
    ]),
    "visibleVideoItems": count(*[
      _type == "videoItem" && isVisible == true
    ]),
    "hiddenMediaItems": count(*[
      _type in ["photoAlbum", "audioItem", "videoItem"] &&
      isVisible == false
    ])
  }`)

  console.log('Herkenbare mediatestdata geplaatst.')
  console.table(counts)
}

main().catch((error) => {
  console.error('Seed mislukt:', error)
  process.exitCode = 1
})
