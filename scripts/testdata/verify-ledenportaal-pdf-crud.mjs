import { createClient } from '@supabase/supabase-js';

const EXPECTED_TEST_ORIGIN =
  'https://lldmyfvhjypomxfpltlx.supabase.co';

const BUCKET =
  'member-song-sheets';

const supabaseUrl =
  process.env.SUPABASE_URL?.trim();

const publishableKey =
  process.env.SUPABASE_PUBLISHABLE_KEY?.trim();

const managerEmail =
  process.env.TEST_CONTENTMANAGER_EMAIL
    ?.trim()
    .toLowerCase();

const managerPassword =
  process.env.TEST_CONTENTMANAGER_PASSWORD;

const memberEmail =
  process.env.TEST_MEMBER_EMAIL
    ?.trim()
    .toLowerCase();

const memberPassword =
  process.env.TEST_MEMBER_PASSWORD;

const required = {
  SUPABASE_URL: supabaseUrl,
  SUPABASE_PUBLISHABLE_KEY: publishableKey,
  TEST_CONTENTMANAGER_EMAIL: managerEmail,
  TEST_CONTENTMANAGER_PASSWORD: managerPassword,
  TEST_MEMBER_EMAIL: memberEmail,
  TEST_MEMBER_PASSWORD: memberPassword,
};

for (const [name, value] of Object.entries(required)) {
  if (!value) {
    throw new Error(
      `Ontbrekende environmentwaarde: ${name}`,
    );
  }
}

let parsedUrl;

try {
  parsedUrl =
    new URL(supabaseUrl);
} catch {
  throw new Error(
    'SUPABASE_URL is ongeldig.',
  );
}

if (
  parsedUrl.origin !==
  EXPECTED_TEST_ORIGIN
) {
  throw new Error(
    `STOP: PDF CRUD-verificatie mag alleen naar ${EXPECTED_TEST_ORIGIN}.`,
  );
}

function client() {
  return createClient(
    supabaseUrl,
    publishableKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    },
  );
}

async function login(
  email,
  password,
  label,
) {
  const instance =
    client();

  const {
    data,
    error,
  } =
    await instance.auth
      .signInWithPassword({
        email,
        password,
      });

  if (
    error ||
    !data?.session
  ) {
    throw new Error(
      `${label} login mislukt: ${
        error?.message ||
        'geen sessie'
      }`,
    );
  }

  return instance;
}

function pdfBytes(label) {
  return new TextEncoder().encode(
    [
      '%PDF-1.4',
      `% B4.1g TEST ${label}`,
      '1 0 obj',
      '<< /Type /Catalog >>',
      'endobj',
      'trailer',
      '<<>>',
      '%%EOF',
      '',
    ].join('\n'),
  );
}

function uniquePath(
  songId,
  suffix,
) {
  const token =
    `${Date.now()}-${crypto.randomUUID()}`;

  return (
    `songs/${songId}/` +
    `b41g-${suffix}-${token}.pdf`
  );
}

async function requireNoError(
  result,
  label,
) {
  if (result.error) {
    throw new Error(
      `${label}: ${result.error.message}`,
    );
  }

  return result.data;
}

const manager =
  await login(
    managerEmail,
    managerPassword,
    'contentmanager',
  );

const member =
  await login(
    memberEmail,
    memberPassword,
    'member',
  );

let song = null;
let originalPdfPath = null;

const createdPaths =
  new Set();

let metadataChanged = false;

try {
  const songResult =
    await manager
      .from('member_songs')
      .select(
        'id,title,is_visible,pdf_path',
      )
      .eq('is_visible', true)
      .order('sort_order', {
        ascending: true,
      })
      .limit(1)
      .maybeSingle();

  song =
    await requireNoError(
      songResult,
      'zichtbaar testlied ophalen',
    );

  if (!song?.id) {
    throw new Error(
      'Geen zichtbaar ledenportaallied beschikbaar voor TEST-CRUD.',
    );
  }

  originalPdfPath =
    song.pdf_path ?? null;

  console.log(
    `test-song-id: ${song.id}`,
  );

  console.log(
    `original-pdf-path-present: ${Boolean(originalPdfPath)}`,
  );


  // ------------------------------------------------
  // 1. MANAGER UPLOADT GELDIGE PDF
  // ------------------------------------------------

  const firstPath =
    uniquePath(
      song.id,
      'upload',
    );

  const firstUpload =
    await manager.storage
      .from(BUCKET)
      .upload(
        firstPath,
        pdfBytes('UPLOAD'),
        {
          contentType:
            'application/pdf',
          upsert: false,
        },
      );

  await requireNoError(
    firstUpload,
    'manager PDF-upload',
  );

  createdPaths.add(
    firstPath,
  );

  const firstMetadata =
    await manager
      .from('member_songs')
      .update({
        pdf_path:
          firstPath,
      })
      .eq(
        'id',
        song.id,
      )
      .select(
        'id,pdf_path',
      )
      .single();

  await requireNoError(
    firstMetadata,
    'manager pdf_path instellen',
  );

  metadataChanged = true;

  console.log(
    'manager-upload: PASS',
  );


  // ------------------------------------------------
  // 2. ACTIEF LID KRIJGT SIGNED DOWNLOAD
  // ------------------------------------------------

  const visibleSong =
    await member
      .from('member_songs')
      .select(
        'id,pdf_path',
      )
      .eq(
        'id',
        song.id,
      )
      .single();

  const memberSong =
    await requireNoError(
      visibleSong,
      'lid leest zichtbaar lied',
    );

  if (
    memberSong.pdf_path !==
    firstPath
  ) {
    throw new Error(
      'Lid ziet niet het verwachte pdf_path.',
    );
  }

  const signed =
    await member.storage
      .from(BUCKET)
      .createSignedUrl(
        firstPath,
        300,
        {
          download: true,
        },
      );

  const signedData =
    await requireNoError(
      signed,
      'signed URL voor actief lid',
    );

  if (
    !signedData?.signedUrl ||
    !signedData.signedUrl
      .startsWith('https://')
  ) {
    throw new Error(
      'Signed download-URL ontbreekt of is ongeldig.',
    );
  }

  console.log(
    'member-signed-download: PASS',
  );


  // ------------------------------------------------
  // 3. GEWOON LID MAG METADATA NIET WIJZIGEN
  // ------------------------------------------------

  const memberWrite =
    await member
      .from('member_songs')
      .update({
        pdf_path: null,
      })
      .eq(
        'id',
        song.id,
      )
      .select(
        'id,pdf_path',
      );

  if (
    memberWrite.error &&
    !/row level security|permission denied/i.test(
      memberWrite.error.message ?? '',
    )
  ) {
    throw new Error(
      `Onverwachte member-writefout: ${memberWrite.error.message}`,
    );
  }

  const returnedRows =
    Array.isArray(memberWrite.data)
      ? memberWrite.data
      : [];

  if (returnedRows.length !== 0) {
    throw new Error(
      `RBAC-fout: gewone member-write retourneerde ${returnedRows.length} gewijzigde rij(en).`,
    );
  }

  const managerVerification =
    await manager
      .from('member_songs')
      .select(
        'id,pdf_path',
      )
      .eq(
        'id',
        song.id,
      )
      .single();

  const verifiedAfterMemberWrite =
    await requireNoError(
      managerVerification,
      'manager verifieert member-writeblokkade',
    );

  if (
    verifiedAfterMemberWrite.pdf_path !==
    firstPath
  ) {
    throw new Error(
      'RBAC-fout: gewone member heeft pdf_path daadwerkelijk gewijzigd.',
    );
  }

  console.log(
    'member-write-denied: PASS',
  );


  // ------------------------------------------------
  // 4. VERKEERDE MIME WORDT GEWEIGERD
  // ------------------------------------------------

  const invalidPath =
    uniquePath(
      song.id,
      'wrong-mime',
    );

  const invalidUpload =
    await manager.storage
      .from(BUCKET)
      .upload(
        invalidPath,
        new TextEncoder()
          .encode('geen pdf'),
        {
          contentType:
            'text/plain',
          upsert: false,
        },
      );

  if (!invalidUpload.error) {
    createdPaths.add(
      invalidPath,
    );

    throw new Error(
      'Storage-fout: text/plain upload werd geaccepteerd.',
    );
  }

  console.log(
    'wrong-mime-denied: PASS',
  );


  // ------------------------------------------------
  // 5. MANAGER VERVANGT PDF
  // ------------------------------------------------

  const secondPath =
    uniquePath(
      song.id,
      'replace',
    );

  const secondUpload =
    await manager.storage
      .from(BUCKET)
      .upload(
        secondPath,
        pdfBytes('REPLACE'),
        {
          contentType:
            'application/pdf',
          upsert: false,
        },
      );

  await requireNoError(
    secondUpload,
    'manager vervangende PDF-upload',
  );

  createdPaths.add(
    secondPath,
  );

  const replaceMetadata =
    await manager
      .from('member_songs')
      .update({
        pdf_path:
          secondPath,
      })
      .eq(
        'id',
        song.id,
      )
      .select(
        'id,pdf_path',
      )
      .single();

  const replaced =
    await requireNoError(
      replaceMetadata,
      'manager pdf_path vervangen',
    );

  if (
    replaced.pdf_path !==
    secondPath
  ) {
    throw new Error(
      'Vervangende pdf_path is niet opgeslagen.',
    );
  }

  const removeFirst =
    await manager.storage
      .from(BUCKET)
      .remove([
        firstPath,
      ]);

  await requireNoError(
    removeFirst,
    'oude tijdelijke PDF verwijderen',
  );

  createdPaths.delete(
    firstPath,
  );

  console.log(
    'manager-replace: PASS',
  );


  // ------------------------------------------------
  // 6. MANAGER VERWIJDERT PDF-KOPPELING + OBJECT
  // ------------------------------------------------

  const clearMetadata =
    await manager
      .from('member_songs')
      .update({
        pdf_path: null,
      })
      .eq(
        'id',
        song.id,
      )
      .select(
        'id,pdf_path',
      )
      .single();

  const cleared =
    await requireNoError(
      clearMetadata,
      'manager pdf_path verwijderen',
    );

  if (
    cleared.pdf_path !== null
  ) {
    throw new Error(
      'pdf_path is niet null na verwijderen.',
    );
  }

  const removeSecond =
    await manager.storage
      .from(BUCKET)
      .remove([
        secondPath,
      ]);

  await requireNoError(
    removeSecond,
    'tijdelijke vervangende PDF verwijderen',
  );

  createdPaths.delete(
    secondPath,
  );

  console.log(
    'manager-remove: PASS',
  );


  // ------------------------------------------------
  // 7. ONTBREKENDE PDF BLIJFT VEILIG
  // ------------------------------------------------

  const missingSigned =
    await member.storage
      .from(BUCKET)
      .createSignedUrl(
        secondPath,
        300,
        {
          download: true,
        },
      );

  if (!missingSigned.error) {
    throw new Error(
      'Verwijderd/niet-gekoppeld PDF-object leverde onverwacht een signed URL op.',
    );
  }

  console.log(
    'missing-pdf-safe: PASS',
  );

  console.log(
    'B4.1g LIVE PDF CRUD — PASS',
  );
} finally {
  if (
    song?.id &&
    metadataChanged
  ) {
    const restore =
      await manager
        .from('member_songs')
        .update({
          pdf_path:
            originalPdfPath,
        })
        .eq(
          'id',
          song.id,
        );

    if (restore.error) {
      console.error(
        'CLEANUP ERROR metadata:',
        restore.error.message,
      );
    } else {
      console.log(
        'cleanup-metadata: PASS',
      );
    }
  }

  const paths =
    [...createdPaths];

  if (
    paths.length > 0
  ) {
    const cleanup =
      await manager.storage
        .from(BUCKET)
        .remove(paths);

    if (cleanup.error) {
      console.error(
        'CLEANUP ERROR storage:',
        cleanup.error.message,
      );
    } else {
      console.log(
        `cleanup-storage: PASS (${paths.length})`,
      );
    }
  }

  await manager.auth.signOut();
  await member.auth.signOut();
}
