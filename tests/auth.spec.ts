import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const VALID_EMAIL = process.env.TEST_ADMIN_EMAIL;
const VALID_PASSWORD = process.env.TEST_ADMIN_PASSWORD;
const ADMIN_DISPLAY_NAME = process.env.TEST_ADMIN_DISPLAY_NAME;
const MEMBER_EMAIL = process.env.TEST_MEMBER_EMAIL;
const MEMBER_PASSWORD = process.env.TEST_MEMBER_PASSWORD;
const MEMBER_DISPLAY_NAME = process.env.TEST_MEMBER_DISPLAY_NAME;
const PENDING_MEMBER_EMAIL = process.env.TEST_MEMBER_PENDING_EMAIL;
const PENDING_MEMBER_PASSWORD = process.env.TEST_MEMBER_PENDING_PASSWORD;
const PENDING_MEMBER_DISPLAY_NAME = process.env.TEST_MEMBER_PENDING_DISPLAY_NAME;
const INACTIVE_MEMBER_EMAIL = process.env.TEST_MEMBER_INACTIVE_EMAIL;
const INACTIVE_MEMBER_PASSWORD = process.env.TEST_MEMBER_INACTIVE_PASSWORD;
const STATUS_MEMBER_EMAIL = process.env.TEST_STATUS_MEMBER_EMAIL;
const STATUS_MEMBER_PASSWORD = process.env.TEST_STATUS_MEMBER_PASSWORD;
const STATUS_MEMBER_DISPLAY_NAME = process.env.TEST_STATUS_MEMBER_DISPLAY_NAME;
const PROFILE_MEMBER_EMAIL = process.env.TEST_PROFILE_MEMBER_EMAIL;
const PROFILE_MEMBER_PASSWORD = process.env.TEST_PROFILE_MEMBER_PASSWORD;
const PROFILE_MEMBER_DISPLAY_NAME = process.env.TEST_PROFILE_MEMBER_DISPLAY_NAME;
const CREATE_MEMBER_EMAIL = process.env.TEST_CREATE_MEMBER_EMAIL;
const CREATE_MEMBER_DISPLAY_NAME = process.env.TEST_CREATE_MEMBER_DISPLAY_NAME;
const CREATE_MEMBER_E2E_ENABLED = process.env.TEST_CREATE_MEMBER_E2E_ENABLED === 'true';
const RESEND_MEMBER_INVITE_E2E_ENABLED = process.env.TEST_RESEND_MEMBER_INVITE_E2E_ENABLED === 'true';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!VALID_EMAIL || !VALID_PASSWORD) {
  throw new Error(
    'Missing required environment variables: TEST_ADMIN_EMAIL and/or TEST_ADMIN_PASSWORD'
  );
}

if (!ADMIN_DISPLAY_NAME) {
  throw new Error('Missing required environment variable: TEST_ADMIN_DISPLAY_NAME');
}

if (!MEMBER_EMAIL || !MEMBER_PASSWORD) {
  throw new Error(
    'Missing required environment variables: TEST_MEMBER_EMAIL and/or TEST_MEMBER_PASSWORD'
  );
}

if (!MEMBER_DISPLAY_NAME) {
  throw new Error('Missing required environment variable: TEST_MEMBER_DISPLAY_NAME');
}

const CONTROLLED_MEMBERS = Array.from({ length: 55 }, (_, index) => {
  const number = index + 1;
  const padded = String(number).padStart(2, '0');
  const status = ['active', 'pending', 'inactive'][index % 3]!;
  const role = number % 10 === 0 ? 'admin' : 'member';

  return {
    id: `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`,
    auth_user_id: `10000000-0000-4000-8000-${String(number).padStart(12, '0')}`,
    full_name: `Lid ${padded} Testpersoon`,
    street: 'Teststraat',
    house_number: String(number),
    postal_code: '1234 AB',
    city: 'Teststad',
    phone: `061234${String(number).padStart(4, '0')}`,
    email: number === 1
      ? 'zeer.lang.emailadres.voor.mobiele.weergave.01@example.test'
      : `lid.${padded}@example.test`,
    role,
    status,
  };
});

function getSupabaseAdminClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}


async function findAuthUserByEmailForCleanup(email: string) {
  const supabaseAdmin = getSupabaseAdminClient();

  if (!supabaseAdmin) {
    throw new Error('SUPABASE_URL en/of SUPABASE_SERVICE_ROLE_KEY ontbreken.');
  }

  const targetEmail = email.trim().toLowerCase();
  let pageNumber = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page: pageNumber,
      perPage,
    });

    if (error) {
      throw error;
    }

    const users = data?.users ?? [];
    const match = users.find((candidate) => candidate.email?.toLowerCase() === targetEmail);

    if (match) {
      return match;
    }

    if (users.length < perPage) {
      return null;
    }

    pageNumber += 1;
  }
}

async function cleanupCreateMemberTestIdentity(email: string) {
  const supabaseAdmin = getSupabaseAdminClient();

  if (!supabaseAdmin) {
    throw new Error('SUPABASE_URL en/of SUPABASE_SERVICE_ROLE_KEY ontbreken.');
  }

  const targetEmail = email.trim().toLowerCase();

  const { error: profileDeleteError } = await supabaseAdmin
    .from('profiles')
    .delete()
    .eq('email', targetEmail);

  if (profileDeleteError) {
    throw profileDeleteError;
  }

  const authUser = await findAuthUserByEmailForCleanup(targetEmail);

  if (authUser?.id) {
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(authUser.id);

    if (authDeleteError) {
      throw authDeleteError;
    }
  }
}

async function getCreateMemberProfile(email: string) {
  const supabaseAdmin = getSupabaseAdminClient();

  if (!supabaseAdmin) {
    throw new Error('SUPABASE_URL en/of SUPABASE_SERVICE_ROLE_KEY ontbreken.');
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('email, full_name, role, status')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function setTestProfileStatus(email: string, status: 'pending' | 'active' | 'inactive') {
  const supabaseAdmin = getSupabaseAdminClient();

  if (!supabaseAdmin) {
    throw new Error('SUPABASE_URL en/of SUPABASE_SERVICE_ROLE_KEY ontbreken.');
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .ilike('email', email)
    .select('email, status')
    .single();

  if (error) {
    throw new Error(`Kon testprofiel ${email} niet naar status ${status} zetten: ${error.message}`);
  }

  if (!data || data.status !== status) {
    throw new Error(`Onverwachte status na reset voor ${email}: ${data?.status ?? 'geen profiel'}`);
  }

  return data;
}

async function getTestProfileStatus(email: string) {
  const supabaseAdmin = getSupabaseAdminClient();

  if (!supabaseAdmin) {
    throw new Error('SUPABASE_URL en/of SUPABASE_SERVICE_ROLE_KEY ontbreken.');
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('email, status')
    .ilike('email', email)
    .single();

  if (error) {
    throw new Error(`Kon testprofiel ${email} niet ophalen: ${error.message}`);
  }

  return data?.status;
}

async function loginAsAdmin(page) {
  await page.goto('http://localhost:5500/leden/login.html');

  await page.fill('#email', VALID_EMAIL!);
  await page.fill('#password', VALID_PASSWORD!);
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL(/dashboard\.html/);
  await expect(page.locator('#status')).toContainText('Je bent succesvol ingelogd');
}

async function loginAsMember(page) {
  await page.goto('http://localhost:5500/leden/login.html');

  await page.fill('#email', MEMBER_EMAIL!);
  await page.fill('#password', MEMBER_PASSWORD!);
  await page.click('button[type="submit"]');

  await page.waitForURL(/dashboard\.html/, { timeout: 15000 });
  await expect(page.locator('#status')).toContainText('Je bent succesvol ingelogd');
}

async function waitForLedenlijstReady(page) {
  await expect(page.locator('#ledenbeheer-toast')).toContainText('Ledenbeheer is geladen.', {
    timeout: 15000,
  });

  await expect(page.locator('#ledenbeheer-lijst-body')).toBeVisible();

  await expect(
    page.locator('#ledenbeheer-lijst-body tr:not(.ledenbeheer-empty-row)').first()
  ).toBeVisible({ timeout: 15000 });

  await expect(page.locator('#ledenbeheer-result-count')).not.toContainText('Nog geen leden geladen.');
}

async function openAdminAndWaitUntilReady(page) {
  await page.goto('http://localhost:5500/admin/index.html');

  await expect(page).toHaveURL(/admin\/index\.html/);
  await expect(page.locator('main')).toContainText('Welkom (Admin)');
  await expect(page.locator('#ledenbeheer')).toBeVisible();
  await expect(page.locator('#nieuw-lid-form')).toBeVisible();

  await page.waitForFunction(async () => {
    if (!window.authHelpers || typeof window.authHelpers.getCurrentSession !== 'function') {
      return false;
    }

    try {
      const session = await window.authHelpers.getCurrentSession();
      return Boolean(session?.access_token);
    } catch {
      return false;
    }
  });

  await expect(page.locator('#ledenbeheer-toast')).toBeVisible();
  await expect(page.locator('#ledenbeheer-lijst-body')).toBeVisible();
  await expect(page.locator('#ledenbeheer-result-count')).toBeVisible();

  await waitForLedenlijstReady(page);
}

async function openMemberActionMenu(page) {
  const memberRow = page.locator('#ledenbeheer-lijst-body tr').filter({ hasText: MEMBER_DISPLAY_NAME });

  await expect(memberRow.locator('.ledenbeheer-action-trigger')).toBeVisible();
  await memberRow.locator('.ledenbeheer-action-trigger').click();

  await expect(memberRow.locator('.ledenbeheer-action-menu')).toHaveClass(/open/);

  return memberRow;
}

function isControlledMembersListUrl(url: URL) {
  const selectedColumns = (url.searchParams.get('select') || '')
    .split(',')
    .map((column) => column.trim());
  const requiredColumns = [
    'id',
    'auth_user_id',
    'full_name',
    'street',
    'house_number',
    'postal_code',
    'city',
    'phone',
    'email',
    'role',
    'status',
  ];
  const order = url.searchParams.get('order') || '';

  return (
    url.pathname.endsWith('/rest/v1/profiles') &&
    requiredColumns.every((column) => selectedColumns.includes(column)) &&
    order.startsWith('full_name.asc')
  );
}

async function installControlledMembersList(page) {
  let membersListGetHandled = false;

  await page.route((url) => isControlledMembersListUrl(url), async (route) => {
    const request = route.request();
    const requestOrigin = request.headers().origin || 'http://localhost:5500';
    const corsHeaders = {
      'access-control-allow-origin': requestOrigin,
      'access-control-allow-headers': 'authorization, apikey, content-profile, prefer, x-client-info',
      'access-control-allow-methods': 'GET, OPTIONS',
      'access-control-expose-headers': 'content-range, content-location',
      'vary': 'Origin',
    };

    if (request.method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: corsHeaders,
        body: '',
      });
      return;
    }

    if (request.method() !== 'GET') {
      await route.abort('blockedbyclient');
      return;
    }

    await route.fulfill({
      status: 200,
      headers: {
        ...corsHeaders,
        'content-type': 'application/json; charset=utf-8',
        'content-profile': 'public',
        'content-range': '0-54/55',
      },
      body: JSON.stringify(CONTROLLED_MEMBERS),
    });

    membersListGetHandled = true;
  });

  return () => membersListGetHandled;
}

async function openAdminWithControlledMembers(page) {
  await loginAsAdmin(page);
  const wasControlledMembersListHandled = await installControlledMembersList(page);

  await page.goto('http://localhost:5500/admin/index.html');

  await expect(page).toHaveURL(/admin\/index\.html/);
  await expect(page.locator('main')).toContainText('Welkom (Admin)');
  await expect(page.locator('#ledenbeheer')).toBeVisible();
  await expect(page.locator('#nieuw-lid-form')).toBeVisible();

  await page.waitForFunction(async () => {
    if (!window.authHelpers || typeof window.authHelpers.getCurrentSession !== 'function') {
      return false;
    }

    try {
      const session = await window.authHelpers.getCurrentSession();
      return Boolean(session?.access_token);
    } catch {
      return false;
    }
  });

  await expect.poll(wasControlledMembersListHandled, {
    message: 'De gecontroleerde read-only ledenlijstrequest is niet onderschept en beantwoord.',
    timeout: 15000,
  }).toBe(true);

  await expect(page.locator('#ledenbeheer-total-count')).toHaveText('55 leden');
  await expect(page.locator('#ledenbeheer-result-count')).toHaveText('Leden 1–10 van 55');
  await expect(page.locator('#ledenbeheer-lijst-body tr.ledenbeheer-member-row')).toHaveCount(10);
}

async function getVisibleMemberCellValues(page, columnIndex: number) {
  return page
    .locator('#ledenbeheer-lijst-body tr.ledenbeheer-member-row')
    .evaluateAll((rows, index) => rows.map((row) => (
      row.children[index as number]?.textContent?.trim().toLowerCase() || ''
    )), columnIndex);
}

async function getTestProfileDetails(email: string) {
  const supabaseAdmin = getSupabaseAdminClient();

  if (!supabaseAdmin) {
    throw new Error('SUPABASE_URL en/of SUPABASE_SERVICE_ROLE_KEY ontbreken.');
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('email, street, house_number, postal_code, city, phone, status')
    .ilike('email', email)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

test('Geldig account kan inloggen en dashboard openen', async ({ page }) => {
  await loginAsAdmin(page);
});

test('Login met fout wachtwoord toont foutmelding', async ({ page }) => {
  await page.goto('http://localhost:5500/leden/login.html');

  await page.fill('#email', VALID_EMAIL!);
  await page.fill('#password', 'FOUT_WACHTWOORD');
  await page.click('button[type="submit"]');

  await expect(page.locator('#error')).toBeVisible();
});

test('Dashboard zonder login redirect naar login', async ({ page }) => {
  await page.goto('http://localhost:5500/leden/dashboard.html');

  await expect(page).toHaveURL(/login\.html/);
});

test('Ingelogde admin kan adminpagina openen', async ({ page }) => {
  await loginAsAdmin(page);
  await openAdminAndWaitUntilReady(page);
});

test('Ingelogde member kan adminpagina niet openen', async ({ page }) => {
  await loginAsMember(page);

  await page.goto('http://localhost:5500/admin/index.html');

  await expect(page).toHaveURL(/login\.html/);
});

test('Ingelogde admin ziet navigatie naar adminomgeving op dashboard', async ({ page }) => {
  await loginAsAdmin(page);

  await expect(page.locator('#admin-link')).toBeVisible();
  await expect(page.locator('#admin-link')).toContainText('Naar adminomgeving');

  await page.click('#admin-link');

  await expect(page).toHaveURL(/admin\/index\.html/);
  await expect(page.locator('#ledenbeheer')).toBeVisible();
});

test('Ingelogde member ziet geen navigatie naar adminomgeving op dashboard', async ({ page }) => {
  await loginAsMember(page);

  await expect(page.locator('#admin-link')).toBeHidden();
});

test('Ingelogde admin ziet navigatie naar ledenomgeving op adminpagina', async ({ page }) => {
  await loginAsAdmin(page);
  await openAdminAndWaitUntilReady(page);

  await expect(page.locator('#ledenomgeving-link')).toBeVisible();
  await expect(page.locator('#ledenomgeving-link')).toContainText('Naar ledenomgeving');

  await page.click('#ledenomgeving-link');

  await expect(page).toHaveURL(/leden\/dashboard\.html/);
  await expect(page.locator('#status')).toContainText('Je bent succesvol ingelogd');
});

test('Ingelogde admin ziet ledenbeheerformulier op adminpagina', async ({ page }) => {
  await loginAsAdmin(page);
  await openAdminAndWaitUntilReady(page);

  await expect(page.locator('#nieuw-lid-submit')).toBeVisible();
  await expect(page.locator('#ledenbeheer-formulier')).toContainText('Nieuw lid toevoegen');
});

test('Ingelogde admin ziet op desktop het formulier in de afgesproken kolomindeling', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await loginAsAdmin(page);
  await openAdminAndWaitUntilReady(page);

  const layout = await page.evaluate(() => {
    const rect = (selector: string) => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) {
        throw new Error(`Element ontbreekt: ${selector}`);
      }

      const bounds = element.getBoundingClientRect();
      return {
        left: Math.round(bounds.left),
        right: Math.round(bounds.right),
        top: Math.round(bounds.top),
        width: Math.round(bounds.width),
      };
    };

    return {
      viewportWidth: document.documentElement.clientWidth,
      card: rect('#ledenbeheer-formulier'),
      fullName: rect('#full_name'),
      street: rect('#street'),
      houseNumber: rect('#house_number'),
      postalCode: rect('#postal_code'),
      city: rect('#city'),
      email: rect('#email'),
      emailConfirm: rect('#email_confirm'),
    };
  });

  expect(layout.card.width).toBeLessThan(950);
  expect(layout.card.width).toBeLessThan(layout.viewportWidth);
  expect(layout.fullName.left).toBe(layout.street.left);
  expect(layout.fullName.right).toBe(layout.houseNumber.right);
  expect(layout.street.top).toBe(layout.houseNumber.top);
  expect(layout.postalCode.top).toBe(layout.city.top);
  expect(layout.email.top).toBe(layout.emailConfirm.top);
  expect(layout.street.width).toBeGreaterThan(layout.houseNumber.width);
  expect(layout.city.width).toBeGreaterThan(layout.postalCode.width);
});

test('Ingelogde admin heeft op mobiel geen pagina-overflow en formulier staat in één kolom', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await loginAsAdmin(page);
  await openAdminAndWaitUntilReady(page);

  const fullName = page.locator('#full_name');
  const street = page.locator('#street');
  const houseNumber = page.locator('#house_number');
  const postalCode = page.locator('#postal_code');
  const city = page.locator('#city');
  const email = page.locator('#email');
  const emailConfirm = page.locator('#email_confirm');
  const submitButton = page.locator('#nieuw-lid-submit');
  const formCard = page.locator('#ledenbeheer-formulier');
  const listCard = page.locator('#ledenbeheer-lijst');
  const tableWrapper = page.locator('.ledenbeheer-table-wrapper');

  await expect(fullName).toBeVisible();
  await expect(submitButton).toBeVisible();
  await expect(listCard).toBeVisible();

  const formLayout = await page.evaluate(() => {
    const rect = (selector: string) => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) {
        throw new Error(`Element ontbreekt: ${selector}`);
      }

      const bounds = element.getBoundingClientRect();
      return {
        left: bounds.left,
        right: bounds.right,
        top: bounds.top,
        bottom: bounds.bottom,
        width: bounds.width,
      };
    };

    return {
      viewportWidth: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
      fullName: rect('#full_name'),
      street: rect('#street'),
      houseNumber: rect('#house_number'),
      postalCode: rect('#postal_code'),
      city: rect('#city'),
      email: rect('#email'),
      emailConfirm: rect('#email_confirm'),
      submitButton: rect('#nieuw-lid-submit'),
      formCard: rect('#ledenbeheer-formulier'),
      listCard: rect('#ledenbeheer-lijst'),
    };
  });

  expect(formLayout.documentWidth).toBeLessThanOrEqual(formLayout.viewportWidth + 1);

  for (const element of [formLayout.formCard, formLayout.listCard, formLayout.submitButton]) {
    expect(element.left).toBeGreaterThanOrEqual(-1);
    expect(element.right).toBeLessThanOrEqual(formLayout.viewportWidth + 1);
  }

  expect(formLayout.houseNumber.top).toBeGreaterThan(formLayout.street.top);
  expect(formLayout.city.top).toBeGreaterThan(formLayout.postalCode.top);
  expect(formLayout.emailConfirm.top).toBeGreaterThan(formLayout.email.top);

  const inputWidths = [
    formLayout.fullName.width,
    formLayout.street.width,
    formLayout.houseNumber.width,
    formLayout.postalCode.width,
    formLayout.city.width,
    formLayout.email.width,
    formLayout.emailConfirm.width,
  ];

  for (const width of inputWidths) {
    expect(width).toBeGreaterThan(200);
    expect(width).toBeLessThanOrEqual(formLayout.formCard.width);
  }

  const tableLayout = await tableWrapper.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    overflowX: window.getComputedStyle(element).overflowX,
  }));

  expect(tableLayout.scrollWidth).toBeLessThanOrEqual(tableLayout.clientWidth + 1);
  expect(tableLayout.overflowX).not.toMatch(/auto|scroll/);

  const firstMemberCard = page.locator('#ledenbeheer-lijst-body tr.ledenbeheer-member-row').first();
  await expect(firstMemberCard).toBeVisible();
  await expect(firstMemberCard.locator('td[data-label="E-mailadres"]')).toBeVisible();
  await expect(firstMemberCard.locator('td[data-label="Rol"]')).toBeVisible();
  await expect(firstMemberCard.locator('td[data-label="Status"]')).toBeVisible();
  await expect(firstMemberCard.locator('td[data-label="Acties"]')).toBeVisible();

  await street.scrollIntoViewIfNeeded();
  await street.fill('Teststraat');
  await houseNumber.fill('14');

  await expect(street).toHaveValue('Teststraat');
  await expect(houseNumber).toHaveValue('14');
});

test('Ingelogde admin ziet schaalbare ledenlijstfuncties', async ({ page }) => {
  await loginAsAdmin(page);
  await openAdminAndWaitUntilReady(page);

  await expect(page.locator('#ledenbeheer-zoek')).toBeVisible();
  await expect(page.locator('#ledenbeheer-status-filter')).toBeVisible();
  await expect(page.locator('#ledenbeheer-role-filter')).toBeVisible();
  await expect(page.locator('#ledenbeheer-sortering')).toBeVisible();
  await expect(page.locator('#ledenbeheer-page-size')).toBeVisible();
  await expect(page.locator('#ledenbeheer-result-count')).toBeVisible();
  await expect(page.locator('#ledenbeheer-total-count')).toBeVisible();
  await expect(page.locator('#ledenbeheer-reset-filters')).toBeVisible();
  await expect(page.locator('#ledenbeheer-prev-page')).toBeVisible();
  await expect(page.locator('#ledenbeheer-next-page')).toBeVisible();
});

test('Ingelogde admin ziet beheeracties in ledenlijst', async ({ page }) => {
  await loginAsAdmin(page);
  await openAdminAndWaitUntilReady(page);

  await expect(page.locator('th')).toContainText(['Naam', 'E-mailadres', 'Rol', 'Status', 'Acties']);

  const adminRow = page.locator('#ledenbeheer-lijst-body tr').filter({ hasText: ADMIN_DISPLAY_NAME });
  await expect(adminRow).toContainText('Eigen account');

  const memberRow = await openMemberActionMenu(page);

  await expect(memberRow.locator('.ledenbeheer-menu-action.edit')).toBeVisible();
  await expect(memberRow.locator('.ledenbeheer-menu-action.edit')).toContainText('Bewerken');
  await expect(memberRow.locator('.ledenbeheer-menu-action.deactivate')).toBeVisible();
  await expect(memberRow.locator('.ledenbeheer-menu-action.deactivate')).toContainText('Deactiveren');
});

// Test statusmutatie: active -> inactive -> active met exacte assertions
test('Ingelogde admin kan lid deactiveren en heractiveren', async ({ page, browserName }) => {
  // Deze test wijzigt Supabase-testdata en mag niet parallel draaien in meerdere browsers.
  test.skip(
    browserName !== 'chromium',
    'Statusmutatie gebruikt gedeelde Supabase-testdata en draait daarom alleen in Chromium.'
  );

  test.skip(
    !STATUS_MEMBER_EMAIL ||
      !STATUS_MEMBER_DISPLAY_NAME ||
      !process.env.SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY,
    'Statusmutatie-testidentity of Supabase service credentials ontbreken.'
  );

  await setTestProfileStatus(STATUS_MEMBER_EMAIL, 'active');

  await loginAsAdmin(page);
  await openAdminAndWaitUntilReady(page);

  await page.selectOption('#ledenbeheer-status-filter', 'active');
  await page.fill('#ledenbeheer-zoek', STATUS_MEMBER_EMAIL);

  const getMemberRow = () =>
    page.locator('#ledenbeheer-lijst-body tr').filter({ hasText: STATUS_MEMBER_EMAIL });

  const getStatusBadge = (memberRow: ReturnType<typeof getMemberRow>) =>
    memberRow.locator('.status-badge');

  let memberRow = getMemberRow();
  await expect(memberRow).toBeVisible({ timeout: 15000 });

  let statusBadge = getStatusBadge(memberRow);
  await expect(statusBadge).toHaveText(/^active$/i);

  await memberRow.locator('.ledenbeheer-action-trigger').click();
  await expect(memberRow.locator('.ledenbeheer-action-menu')).toHaveClass(/open/);

  await memberRow.locator('.ledenbeheer-menu-action.deactivate').click();

  await expect(page.locator('#ledenbeheer-toast')).toContainText('Lid is gedeactiveerd.');
  await expect
    .poll(async () => getTestProfileStatus(STATUS_MEMBER_EMAIL), {
      timeout: 15000,
      message: 'De backendstatus is niet inactive geworden.',
    })
    .toBe('inactive');

  await page.reload();
  await waitForLedenlijstReady(page);
  await page.selectOption('#ledenbeheer-status-filter', 'inactive');
  await page.fill('#ledenbeheer-zoek', STATUS_MEMBER_EMAIL);

  memberRow = getMemberRow();
  statusBadge = getStatusBadge(memberRow);

  await expect(memberRow).toBeVisible({ timeout: 15000 });
  await expect(statusBadge).toHaveText(/^inactive$/i);

  await memberRow.locator('.ledenbeheer-action-trigger').click();
  await expect(memberRow.locator('.ledenbeheer-action-menu')).toHaveClass(/open/);

  await memberRow.locator('.ledenbeheer-menu-action.activate').click();

  await expect(page.locator('#ledenbeheer-toast')).toContainText('Lid is geheractiveerd.');
  await expect
    .poll(async () => getTestProfileStatus(STATUS_MEMBER_EMAIL), {
      timeout: 15000,
      message: 'De backendstatus is niet active geworden.',
    })
    .toBe('active');

  await page.reload();
  await waitForLedenlijstReady(page);
  await page.selectOption('#ledenbeheer-status-filter', 'active');
  await page.fill('#ledenbeheer-zoek', STATUS_MEMBER_EMAIL);

  memberRow = getMemberRow();
  statusBadge = getStatusBadge(memberRow);

  await expect(memberRow).toBeVisible({ timeout: 15000 });
  await expect(statusBadge).toHaveText(/^active$/i);
});
test('Ingelogde admin kan bewerkmodal voor lid openen en sluiten', async ({ page }) => {
  await loginAsAdmin(page);
  await openAdminAndWaitUntilReady(page);

  const memberRow = await openMemberActionMenu(page);

  const actionTrigger = memberRow.locator('.ledenbeheer-action-trigger');
  const editButton = memberRow.locator('.ledenbeheer-menu-action.edit');
  await editButton.click();

  await expect(page.locator('#ledenbeheer-edit-modal')).toHaveClass(/open/);
  await expect(page.locator('#ledenbeheer-edit-title')).toContainText('Lidgegevens bewerken');
  await expect(page.locator('#edit_full_name')).toBeVisible();
  await expect(page.locator('#edit_full_name')).toBeFocused();
  await expect(page.locator('#edit_email')).toBeVisible();
  await expect(page.locator('#edit_role')).toBeVisible();
  await expect(page.locator('#edit_status')).toBeVisible();
  await expect(page.locator('#edit_email')).toHaveAttribute('readonly', '');
  await expect(page.locator('#edit_role')).toHaveAttribute('readonly', '');
  await expect(page.locator('#edit_status')).toHaveAttribute('readonly', '');
  await expect(page.locator('#ledenbeheer-edit-save')).toBeVisible();
  await expect(page.locator('#ledenbeheer-edit-cancel')).toBeVisible();

  await page.keyboard.press('Escape');

  await expect(page.locator('#ledenbeheer-edit-modal')).not.toHaveClass(/open/);
  await expect(actionTrigger).toBeFocused();
});

// Controleert client-side validatie zonder echte lidgegevensmutatie.
test('Ingelogde admin ziet veldvalidatie in bewerkmodal', async ({ page }) => {
  await loginAsAdmin(page);
  await openAdminAndWaitUntilReady(page);

  const memberRow = await openMemberActionMenu(page);

  await memberRow.locator('.ledenbeheer-menu-action.edit').click();

  await expect(page.locator('#ledenbeheer-edit-modal')).toHaveClass(/open/);

  await page.fill('#edit_house_number', 'testhuisnummer');
  await page.click('#ledenbeheer-edit-save');

  await expect(page.locator('#edit_house_number_error')).toBeVisible();
  await expect(page.locator('#edit_house_number_error')).toContainText('Huisnummer moet met een cijfer beginnen');

  await page.fill('#edit_house_number', '10A');
  await page.fill('#edit_phone', '0613694301B');
  await page.click('#ledenbeheer-edit-save');

  await expect(page.locator('#edit_phone_error')).toBeVisible();
  await expect(page.locator('#edit_phone_error')).toContainText('Telefoonnummer mag alleen cijfers');

  await page.click('#ledenbeheer-edit-cancel');

  await expect(page.locator('#ledenbeheer-edit-modal')).not.toHaveClass(/open/);
});

// Controleert daadwerkelijke profielbewerking via de admin-UI met een aparte testmember.
// De test wijzigt alleen toegestane profielvelden en zet de waarden daarna terug.
test('Ingelogde admin kan profielgegevens van apart testlid wijzigen en herstellen', async ({ page, browserName }) => {
  test.skip(
    browserName !== 'chromium',
    'Profielbewerking gebruikt gedeelde Supabase-testdata en draait daarom alleen in Chromium.'
  );

  if (!PROFILE_MEMBER_EMAIL || !PROFILE_MEMBER_PASSWORD || !PROFILE_MEMBER_DISPLAY_NAME) {
    test.skip(
      true,
      'TEST_PROFILE_MEMBER_EMAIL/PASSWORD/DISPLAY_NAME ontbreekt; profielbewerking-test wordt overgeslagen.'
    );
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    test.skip(true, 'Supabase service credentials ontbreken voor backend- en persistentiecontrole.');
  }

  await loginAsAdmin(page);
  await openAdminAndWaitUntilReady(page);

  const profileRowByEmail = () =>
    page.locator('#ledenbeheer-lijst-body tr').filter({ hasText: PROFILE_MEMBER_EMAIL! });

  const openProfileEditModal = async () => {
    const row = profileRowByEmail();
    await expect(row).toBeVisible({ timeout: 15000 });

    await row.locator('.ledenbeheer-action-trigger').click();

    const editButton = row.locator('.ledenbeheer-menu-action').filter({ hasText: 'Bewerken' });
    await expect(editButton).toBeVisible();
    await editButton.click();

    await expect(page.locator('#ledenbeheer-edit-modal')).toHaveClass(/open/);
    await expect(page.locator('#edit_email')).toHaveValue(PROFILE_MEMBER_EMAIL!);
    await expect(page.locator('#edit_role')).toHaveAttribute('readonly', '');
    await expect(page.locator('#edit_status')).toHaveAttribute('readonly', '');
  };

  await openProfileEditModal();

  const originalValues = {
    street: await page.locator('#edit_street').inputValue(),
    houseNumber: await page.locator('#edit_house_number').inputValue(),
    postalCode: await page.locator('#edit_postal_code').inputValue(),
    city: await page.locator('#edit_city').inputValue(),
    phone: await page.locator('#edit_phone').inputValue(),
  };

  const updatedValues = {
    street: 'Profielteststraat',
    houseNumber: '42A',
    postalCode: '4321 BA',
    city: 'Testplaats',
    phone: '0611111111',
  };

  await page.fill('#edit_street', updatedValues.street);
  await page.fill('#edit_house_number', updatedValues.houseNumber);
  await page.fill('#edit_postal_code', updatedValues.postalCode);
  await page.fill('#edit_city', updatedValues.city);
  await page.fill('#edit_phone', updatedValues.phone);
  await page.click('#ledenbeheer-edit-save');

  await expect(page.locator('#ledenbeheer-toast')).toContainText('Lidgegevens zijn opgeslagen.');
  await expect(page.locator('#ledenbeheer-edit-modal')).not.toHaveClass(/open/);

  await expect
    .poll(async () => getTestProfileDetails(PROFILE_MEMBER_EMAIL!), {
      timeout: 15000,
      message: 'De gewijzigde profielgegevens zijn niet in de backend opgeslagen.',
    })
    .toMatchObject({
      street: updatedValues.street,
      house_number: updatedValues.houseNumber,
      postal_code: updatedValues.postalCode,
      city: updatedValues.city,
      phone: updatedValues.phone,
    });

  await page.reload();
  await waitForLedenlijstReady(page);
  await openProfileEditModal();

  await expect(page.locator('#edit_street')).toHaveValue(updatedValues.street);
  await expect(page.locator('#edit_house_number')).toHaveValue(updatedValues.houseNumber);
  await expect(page.locator('#edit_postal_code')).toHaveValue(updatedValues.postalCode);
  await expect(page.locator('#edit_city')).toHaveValue(updatedValues.city);
  await expect(page.locator('#edit_phone')).toHaveValue(updatedValues.phone);

  await page.fill('#edit_street', originalValues.street);
  await page.fill('#edit_house_number', originalValues.houseNumber);
  await page.fill('#edit_postal_code', originalValues.postalCode);
  await page.fill('#edit_city', originalValues.city);
  await page.fill('#edit_phone', originalValues.phone);
  await page.click('#ledenbeheer-edit-save');

  await expect(page.locator('#ledenbeheer-toast')).toContainText('Lidgegevens zijn opgeslagen.');
  await expect(page.locator('#ledenbeheer-edit-modal')).not.toHaveClass(/open/);

  await expect
    .poll(async () => getTestProfileDetails(PROFILE_MEMBER_EMAIL!), {
      timeout: 15000,
      message: 'De oorspronkelijke profielgegevens zijn niet in de backend hersteld.',
    })
    .toMatchObject({
      street: originalValues.street,
      house_number: originalValues.houseNumber,
      postal_code: originalValues.postalCode,
      city: originalValues.city,
      phone: originalValues.phone,
    });

  await page.reload();
  await waitForLedenlijstReady(page);
  await openProfileEditModal();

  await expect(page.locator('#edit_street')).toHaveValue(originalValues.street);
  await expect(page.locator('#edit_house_number')).toHaveValue(originalValues.houseNumber);
  await expect(page.locator('#edit_postal_code')).toHaveValue(originalValues.postalCode);
  await expect(page.locator('#edit_city')).toHaveValue(originalValues.city);
  await expect(page.locator('#edit_phone')).toHaveValue(originalValues.phone);

  await page.click('#ledenbeheer-edit-cancel');
  await expect(page.locator('#ledenbeheer-edit-modal')).not.toHaveClass(/open/);
});

test('Ingelogde admin kan gecontroleerd zoeken, combineren, nulresultaat tonen en filters wissen', async ({ page }) => {
  await openAdminWithControlledMembers(page);

  const rows = page.locator('#ledenbeheer-lijst-body tr.ledenbeheer-member-row');
  const resultCount = page.locator('#ledenbeheer-result-count');

  await expect(rows).toHaveCount(10);
  await expect(resultCount).toHaveText('Leden 1–10 van 55');

  await page.fill('#ledenbeheer-zoek', 'Lid 07');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('Lid 07 Testpersoon');
  await expect(resultCount).toHaveText('Leden 1–1 van 1 gevonden leden (55 totaal)');

  await page.fill('#ledenbeheer-zoek', 'zeer.lang.emailadres');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText(
    'zeer.lang.emailadres.voor.mobiele.weergave.01@example.test'
  );

  await page.fill('#ledenbeheer-zoek', '');
  await page.selectOption('#ledenbeheer-role-filter', 'member');
  await page.selectOption('#ledenbeheer-status-filter', 'inactive');

  await expect(rows.first()).toBeVisible();
  const filteredRows = await rows.evaluateAll((items) => items.map((row) => ({
    role: row.querySelector('.role-badge')?.textContent?.trim(),
    status: row.querySelector('.status-badge')?.textContent?.trim(),
  })));

  expect(filteredRows.length).toBeGreaterThan(0);
  expect(filteredRows.every((row) => row.role === 'member')).toBe(true);
  expect(filteredRows.every((row) => row.status === 'inactive')).toBe(true);

  await page.fill('#ledenbeheer-zoek', 'bestaat-niet');
  await expect(page.locator('#ledenbeheer-lijst-body tr.ledenbeheer-empty-row')).toBeVisible();
  await expect(resultCount).toHaveText('Geen leden gevonden (55 totaal).');

  await page.selectOption('#ledenbeheer-sortering', 'email');
  await page.selectOption('#ledenbeheer-page-size', '25');
  await page.click('#ledenbeheer-reset-filters');

  await expect(page.locator('#ledenbeheer-zoek')).toHaveValue('');
  await expect(page.locator('#ledenbeheer-status-filter')).toHaveValue('all');
  await expect(page.locator('#ledenbeheer-role-filter')).toHaveValue('all');
  await expect(page.locator('#ledenbeheer-sortering')).toHaveValue('full_name');
  await expect(page.locator('#ledenbeheer-page-size')).toHaveValue('10');
  await expect(page.locator('#ledenbeheer-page-status')).toHaveText('Pagina 1 van 6');
  await expect(resultCount).toHaveText('Leden 1–10 van 55');
  await expect(rows).toHaveCount(10);
  await expect(page.locator('#ledenbeheer-zoek')).toBeFocused();
});

test('Ingelogde admin ziet gecontroleerde sortering voor naam, e-mail, rol en status', async ({ page }) => {
  await openAdminWithControlledMembers(page);
  await page.selectOption('#ledenbeheer-page-size', '50');

  const sortCases = [
    { option: 'full_name', column: 0 },
    { option: 'email', column: 1 },
    { option: 'role', column: 2 },
    { option: 'status', column: 3 },
  ];

  for (const sortCase of sortCases) {
    await page.selectOption('#ledenbeheer-sortering', sortCase.option);
    const values = await getVisibleMemberCellValues(page, sortCase.column);
    const sortedValues = [...values].sort((a, b) =>
      a.localeCompare(b, 'nl', { sensitivity: 'base' })
    );

    expect(values).toHaveLength(50);
    expect(values).toEqual(sortedValues);
  }
});

test('Ingelogde admin ziet gecontroleerde paginering, tellingen en page-size', async ({ page }) => {
  await openAdminWithControlledMembers(page);

  const rows = page.locator('#ledenbeheer-lijst-body tr.ledenbeheer-member-row');
  const names = () => getVisibleMemberCellValues(page, 0);

  await expect(rows).toHaveCount(10);
  await expect(page.locator('#ledenbeheer-prev-page')).toBeDisabled();
  await expect(page.locator('#ledenbeheer-next-page')).toBeEnabled();
  await expect(page.locator('#ledenbeheer-page-status')).toHaveText('Pagina 1 van 6');
  const firstPageNames = await names();

  await page.click('#ledenbeheer-next-page');
  await expect(page.locator('#ledenbeheer-page-status')).toHaveText('Pagina 2 van 6');
  const secondPageNames = await names();
  expect(secondPageNames).not.toEqual(firstPageNames);

  await page.click('#ledenbeheer-prev-page');
  const restoredFirstPageNames = await names();
  expect(restoredFirstPageNames).toEqual(firstPageNames);

  await page.selectOption('#ledenbeheer-page-size', '25');
  await expect(rows).toHaveCount(25);
  await expect(page.locator('#ledenbeheer-page-status')).toHaveText('Pagina 1 van 3');
  await expect(page.locator('#ledenbeheer-result-count')).toHaveText('Leden 1–25 van 55');

  await page.selectOption('#ledenbeheer-page-size', '50');
  await expect(rows).toHaveCount(50);
  await expect(page.locator('#ledenbeheer-page-status')).toHaveText('Pagina 1 van 2');

  await page.click('#ledenbeheer-next-page');
  await expect(rows).toHaveCount(5);
  await expect(page.locator('#ledenbeheer-page-status')).toHaveText('Pagina 2 van 2');
  await expect(page.locator('#ledenbeheer-result-count')).toHaveText('Leden 51–55 van 55');
  await expect(page.locator('#ledenbeheer-next-page')).toBeDisabled();
  await expect(page.locator('#ledenbeheer-prev-page')).toBeEnabled();
});

test('Ingelogde admin ziet op mobiel volledige ledenkaarten zonder afgekapt e-mailadres', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await openAdminWithControlledMembers(page);

  const firstCard = page.locator('#ledenbeheer-lijst-body tr.ledenbeheer-member-row').first();
  const emailCell = firstCard.locator('td[data-label="E-mailadres"]');
  const roleCell = firstCard.locator('td[data-label="Rol"]');
  const statusCell = firstCard.locator('td[data-label="Status"]');
  const actionsCell = firstCard.locator('td[data-label="Acties"]');

  await expect(firstCard).toBeVisible();
  await expect(emailCell).toContainText(
    'zeer.lang.emailadres.voor.mobiele.weergave.01@example.test'
  );
  await expect(roleCell).toBeVisible();
  await expect(statusCell).toBeVisible();
  await expect(actionsCell).toBeVisible();

  const layout = await page.evaluate(() => {
    const card = document.querySelector('#ledenbeheer-lijst-body tr.ledenbeheer-member-row');
    const email = card?.querySelector('td[data-label="E-mailadres"]');

    if (!(card instanceof HTMLElement) || !(email instanceof HTMLElement)) {
      throw new Error('Mobiele ledenkaart of e-mailcel ontbreekt.');
    }

    const cardRect = card.getBoundingClientRect();
    const emailRect = email.getBoundingClientRect();

    return {
      viewportWidth: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
      cardLeft: cardRect.left,
      cardRight: cardRect.right,
      cardScrollWidth: card.scrollWidth,
      cardClientWidth: card.clientWidth,
      emailLeft: emailRect.left,
      emailRight: emailRect.right,
      emailScrollWidth: email.scrollWidth,
      emailClientWidth: email.clientWidth,
    };
  });

  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);
  expect(layout.cardLeft).toBeGreaterThanOrEqual(-1);
  expect(layout.cardRight).toBeLessThanOrEqual(layout.viewportWidth + 1);
  expect(layout.cardScrollWidth).toBeLessThanOrEqual(layout.cardClientWidth + 1);
  expect(layout.emailLeft).toBeGreaterThanOrEqual(layout.cardLeft - 1);
  expect(layout.emailRight).toBeLessThanOrEqual(layout.cardRight + 1);
  expect(layout.emailScrollWidth).toBeLessThanOrEqual(layout.emailClientWidth + 1);

  const actionTrigger = firstCard.locator('.ledenbeheer-action-trigger');
  await actionTrigger.click();
  await expect(firstCard.locator('.ledenbeheer-action-menu')).toHaveClass(/open/);
  await expect(firstCard.locator('.ledenbeheer-menu-action.edit')).toBeVisible();
});

test('Ingelogde admin ziet toastmelding bij client-side validatiefout nieuw lid', async ({ page }) => {
  await loginAsAdmin(page);
  await openAdminAndWaitUntilReady(page);

  await page.click('#nieuw-lid-submit');

  await expect(page.locator('#full_name_error')).toBeVisible();
  await expect(page.locator('#full_name_error')).toContainText('Volledige naam is verplicht.');

  const toast = page.locator('#ledenbeheer-toast');
  const closeButton = page.locator('#ledenbeheer-toast-close');

  await expect(toast).toBeVisible();
  await expect(toast).toContainText('Volledige naam is verplicht.');
  await expect(toast).toHaveCSS('position', 'fixed');
  await expect(toast).toHaveAttribute('role', 'alert');
  await expect(toast).toHaveAttribute('aria-live', 'assertive');
  await expect(toast).toHaveAttribute('aria-atomic', 'true');
  await expect(closeButton).toBeVisible();

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(toast).toBeVisible();

  await closeButton.click();
  await expect(toast).toBeHidden();

  await page.click('#nieuw-lid-submit');
  await expect(toast).toBeVisible();
  await expect(toast).toContainText('Volledige naam is verplicht.');
});

test('Ingelogde admin krijgt backend-foutmelding bij bestaand e-mailadres', async ({ page }) => {
  await loginAsAdmin(page);
  await openAdminAndWaitUntilReady(page);

  await page.fill('#full_name', 'Bestaand Test Lid');
  await page.fill('#street', 'Dorpsstraat');
  await page.fill('#house_number', '10');
  await page.fill('#postal_code', '1234 AB');
  await page.fill('#city', 'Angerlo');
  await page.fill('#email', VALID_EMAIL!);
  await page.fill('#email_confirm', VALID_EMAIL!);
  await page.fill('#phone', '0612345678');

  await page.click('#nieuw-lid-submit');

  await expect(page.locator('#ledenbeheer-toast')).toBeVisible();
  await expect(page.locator('#ledenbeheer-toast')).toContainText(
    'Er bestaat al een lid met dit e-mailadres.'
  );
});

test('Ingelogde gebruiker kan volledig uitloggen en verliest toegang tot dashboard', async ({ page }) => {
  await loginAsAdmin(page);

  // Beginsituatie: gebruiker is ingelogd en heeft een werkelijke Supabase-sessie.
  const sessionBeforeLogout = await page.evaluate(async () => {
    const session = await window.authHelpers.getCurrentSession();

    return {
      hasAccessToken: Boolean(session?.access_token),
      userId: session?.user?.id ?? null,
    };
  });

  expect(sessionBeforeLogout.hasAccessToken).toBe(true);
  expect(sessionBeforeLogout.userId).toBeTruthy();
  await expect(page.locator('#logout')).toBeVisible();

  // Gebruikersactie: uitloggen via de zichtbare knop.
  await page.click('#logout');

  // Zichtbaar resultaat: gebruiker komt op de loginpagina.
  await expect(page).toHaveURL(/login\.html/);
  await expect(page.locator('h1')).toHaveText('Inloggen');
  await expect(page.locator('#login-form')).toBeVisible();

  // Technisch resultaat: de Supabase-sessie bestaat niet meer.
  await page.waitForFunction(async () => {
    if (!window.authHelpers || typeof window.authHelpers.getCurrentSession !== 'function') {
      return false;
    }

    try {
      const session = await window.authHelpers.getCurrentSession();
      return session === null;
    } catch {
      return false;
    }
  });

  const hasSessionAfterLogout = await page.evaluate(async () => {
    const session = await window.authHelpers.getCurrentSession();
    return Boolean(session);
  });

  expect(hasSessionAfterLogout).toBe(false);

  // Functionele beveiligingscontrole: dashboard rechtstreeks opnieuw openen wordt geweigerd.
  await page.goto('http://localhost:5500/leden/dashboard.html');

  await expect(page).toHaveURL(/login\.html/);
  await expect(page.locator('h1')).toHaveText('Inloggen');
  await expect(page.locator('#login-form')).toBeVisible();
});



test('Ingelogde admin kan pending lid opnieuw uitnodigen via opt-in test', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Runtime resend-invite test wordt bewust alleen in Chromium uitgevoerd.');
  test.skip(!RESEND_MEMBER_INVITE_E2E_ENABLED, 'Resend-member-invite E2E-test is opt-in.');

  test.skip(
    !PENDING_MEMBER_EMAIL ||
      !PENDING_MEMBER_DISPLAY_NAME ||
      !process.env.SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY,
    'Pending testidentity of Supabase service credentials ontbreken.'
  );

  await setTestProfileStatus(PENDING_MEMBER_EMAIL, 'pending');

  await loginAsAdmin(page);
  await openAdminAndWaitUntilReady(page);

  await page.selectOption('#ledenbeheer-status-filter', 'pending');
  await page.fill('#ledenbeheer-zoek', PENDING_MEMBER_EMAIL);

  const pendingMemberRow = page
    .locator('#ledenbeheer-lijst-body tr')
    .filter({ hasText: PENDING_MEMBER_EMAIL });

  await expect(pendingMemberRow).toBeVisible({ timeout: 15000 });
  await expect(pendingMemberRow.locator('.status-badge')).toHaveText(/^pending$/i);

  await pendingMemberRow.locator('[data-action-menu-trigger]').click();

  const resendButton = pendingMemberRow.locator('.ledenbeheer-menu-action.resend-invite');
  await expect(resendButton).toBeVisible();
  await expect(resendButton).toContainText('Opnieuw uitnodigen');

  await resendButton.click();

  const toast = page.locator('#ledenbeheer-toast');
  await expect(toast).toBeVisible({ timeout: 15000 });
  await expect(toast).toContainText(
    /Uitnodiging is opnieuw verzonden|opnieuw verzonden|e-maillimiet|tijdelijk geblokkeerd|rate limit/i,
    { timeout: 15000 }
  );
});
test('Ingelogde admin kan nieuw lid uitnodigen en pending profiel aanmaken', async ({ page, browserName }) => {
  test.skip(
    browserName !== 'chromium',
    'Create-member test muteert Supabase Auth en public.profiles en draait daarom alleen in Chromium.'
  );

  if (!CREATE_MEMBER_E2E_ENABLED) {
    test.skip(true, 'TEST_CREATE_MEMBER_E2E_ENABLED staat niet op true; create-member E2E-test wordt overgeslagen.');
    return;
  }

  if (!CREATE_MEMBER_EMAIL || !CREATE_MEMBER_DISPLAY_NAME) {
    test.skip(true, 'TEST_CREATE_MEMBER_* ontbreekt; create-member E2E-test wordt overgeslagen.');
    return;
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    test.skip(true, 'SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ontbreekt; cleanup en controle zijn niet mogelijk.');
    return;
  }

  await cleanupCreateMemberTestIdentity(CREATE_MEMBER_EMAIL);

  try {
    await loginAsAdmin(page);
    await openAdminAndWaitUntilReady(page);

    await page.fill('#full_name', CREATE_MEMBER_DISPLAY_NAME);
    await page.fill('#street', 'Teststraat');
    await page.fill('#house_number', '1');
    await page.fill('#postal_code', '1234 AB');
    await page.fill('#city', 'Teststad');
    await page.fill('#email', CREATE_MEMBER_EMAIL);
    await page.fill('#email_confirm', CREATE_MEMBER_EMAIL);
    await page.fill('#phone', '0612345678');

    await page.click('#nieuw-lid-submit');

    await expect(page.locator('#ledenbeheer-toast')).toContainText(
      /succesvol|uitgenodigd|profiel aangemaakt/i,
      { timeout: 20000 }
    );

    await expect
      .poll(async () => {
        const profile = await getCreateMemberProfile(CREATE_MEMBER_EMAIL);
        return profile ? `${profile.role}:${profile.status}` : 'missing';
      }, {
        timeout: 20000,
        message: 'Create-member profiel is niet als member:pending aangemaakt.',
      })
      .toBe('member:pending');

    await expect(page.locator('#ledenbeheer-lijst-body')).toContainText(CREATE_MEMBER_EMAIL, {
      timeout: 15000,
    });

    await page.reload();
    await waitForLedenlijstReady(page);
    await page.fill('#ledenbeheer-zoek', CREATE_MEMBER_EMAIL);
    await expect(page.locator('#ledenbeheer-lijst-body')).toContainText(CREATE_MEMBER_EMAIL, {
      timeout: 15000,
    });
  } finally {
    await cleanupCreateMemberTestIdentity(CREATE_MEMBER_EMAIL);
  }
});

// Test dat pending accounts automatisch worden geactiveerd bij dashboard-login
test('Pending lid wordt automatisch geactiveerd bij dashboard-login', async ({ page, browserName }) => {
  // Deze test wijzigt Supabase-testdata en mag niet parallel draaien in meerdere browsers.
  test.skip(
    browserName !== 'chromium',
    'Pending activatie gebruikt gedeelde Supabase-testdata en draait daarom alleen in Chromium.'
  );

  // Skip als TEST_MEMBER_PENDING_* variabelen ontbreken
  if (!PENDING_MEMBER_EMAIL || !PENDING_MEMBER_PASSWORD || !PENDING_MEMBER_DISPLAY_NAME) {
    test.skip(true, 'TEST_MEMBER_PENDING_* ontbreekt; pending activatie-test wordt overgeslagen.');
    return;
  }

  // Skip als Supabase service-role configuratie ontbreekt
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    test.skip(true, 'SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ontbreekt; pending activatie-test wordt overgeslagen.');
    return;
  }

  // Zet het gedeelde pending-testprofiel eerst terug naar pending, zodat de test herhaalbaar is.
  await setTestProfileStatus(PENDING_MEMBER_EMAIL, 'pending');

  // Login als pending member
  await page.goto('http://localhost:5500/leden/login.html');

  await page.fill('#email', PENDING_MEMBER_EMAIL);
  await page.fill('#password', PENDING_MEMBER_PASSWORD);
  await page.click('button[type="submit"]');

  // Dashboard activeert pending profiel via activate_current_user_profile.
  await page.waitForURL(/dashboard\.html/, { timeout: 15000 });

  const statusEl = page.locator('#status');
  await expect(statusEl).toBeVisible();
  await expect(statusEl).toContainText('Je bent succesvol ingelogd', { timeout: 15000 });

  // Controleer in Supabase dat het profiel na dashboard-login active is geworden.
  await expect
    .poll(async () => getTestProfileStatus(PENDING_MEMBER_EMAIL), {
      timeout: 15000,
      message: 'Pending testprofiel is niet naar active gezet.',
    })
    .toBe('active');
});

// Test dat inactive accounts geen toegang krijgen tot dashboard
test('Inactief lid krijgt geen toegang tot dashboard', async ({ page, browserName }) => {
  // Deze test controleert een redirect-flow met gedeelde Supabase-testdata en draait daarom alleen in Chromium.
  test.skip(
    browserName !== 'chromium',
    'Inactive toegang gebruikt gedeelde Supabase-testdata en draait daarom alleen in Chromium.'
  );

  // Skip als TEST_MEMBER_INACTIVE_* variabelen ontbreken
  if (!INACTIVE_MEMBER_EMAIL || !INACTIVE_MEMBER_PASSWORD) {
    test.skip(true, 'TEST_MEMBER_INACTIVE_EMAIL/PASSWORD ontbreekt; inactive test wordt overgeslagen.');
    return;
  }

  // Login als inactive member
  await page.goto('http://localhost:5500/leden/login.html');

  await page.fill('#email', INACTIVE_MEMBER_EMAIL);
  await page.fill('#password', INACTIVE_MEMBER_PASSWORD);
  await page.click('button[type="submit"]');

  // Wacht tot dashboard.html bereikt is (ook al wordt het direct weer verlaten)
  await page.waitForURL(/dashboard\.html/, { timeout: 15000 });

  // Controleer dat #status zichtbaar is
  const statusEl = page.locator('#status');
  await expect(statusEl).toBeVisible();

  // Controleer dat status een duidelijke inactive-melding bevat
  await expect(statusEl).toContainText('niet actief');

  // Controleer dat gebruiker teruggaat naar login.html
  await page.waitForURL(/login\.html/, { timeout: 3000 });
});
