import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'

const WORKFLOW =
  '.github/workflows/supabase-test-deploy.yml'

function jobBlock(source, jobName) {
  const lines = source
    .replace(/\r\n/g, '\n')
    .split('\n')

  const start = lines.findIndex(
    (line) => line === `  ${jobName}:`,
  )

  assert.notEqual(start, -1, `Job ${jobName} ontbreekt`)

  let end = lines.length

  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^  [A-Za-z0-9_-]+:$/.test(lines[index])) {
      end = index
      break
    }
  }

  return lines.slice(start, end).join('\n')
}

async function workflowSource() {
  return readFile(WORKFLOW, 'utf8')
}

test(
  'workflow_dispatch blijft de permanente expliciete deploymentroute',
  async () => {
    const source = await workflowSource()
    const preview = jobBlock(source, 'preview-test')
    const deployDb = jobBlock(source, 'deploy-db-test')
    const deploy = jobBlock(source, 'deploy-test')

    assert.match(source, /^\s*workflow_dispatch:$/m)
    assert.match(source, /type:\s*choice/)
    assert.match(source, /-\s*preview/)
    assert.match(source, /-\s*db-deploy/)
    assert.match(source, /-\s*deploy/)
    assert.match(source, /PREVIEW_SUPABASE_TEST/)
    assert.match(source, /DEPLOY_SUPABASE_TEST_DB/)
    assert.match(source, /DEPLOY_SUPABASE_TEST/)
    assert.match(preview, /inputs\.mode == 'preview'/)
    assert.match(preview, /inputs\.mode == 'db-deploy'/)
    assert.match(preview, /inputs\.mode == 'deploy'/)
    assert.match(deployDb, /inputs\.mode == 'db-deploy'/)
    assert.match(deployDb, /^    needs: preview-test$/m)
    assert.match(deployDb, /^        run: supabase db push$/m)
    assert.doesNotMatch(deployDb, /supabase functions deploy/)
    assert.match(deploy, /inputs\.mode == 'deploy'/)
    assert.match(deploy, /^    needs: preview-test$/m)
    assert.match(deploy, /^        run: supabase db push$/m)
    assert.match(deploy, /supabase functions deploy create-member/)
    assert.match(deploy, /supabase functions deploy resend-member-invite/)
  },
)

test(
  'preview-mode kan de muterende deploy-job niet activeren',
  async () => {
    const source = await workflowSource()
    const deployDb = jobBlock(source, 'deploy-db-test')
    const deploy = jobBlock(source, 'deploy-test')

    assert.match(deployDb, /inputs\.mode == 'db-deploy'/)
    assert.doesNotMatch(deployDb, /inputs\.mode == 'preview'/)
    assert.match(deploy, /inputs\.mode == 'deploy'/)
    assert.doesNotMatch(deploy, /inputs\.mode == 'preview'/)
  },
)

test(
  'db-deploy-mode voert alleen databasewrite uit',
  async () => {
    const source = await workflowSource()
    const deployDb = jobBlock(source, 'deploy-db-test')

    assert.match(deployDb, /inputs\.mode == 'db-deploy'/)
    assert.match(deployDb, /^    needs: preview-test$/m)
    assert.match(deployDb, /^        run: supabase db push$/m)
    assert.doesNotMatch(deployDb, /supabase functions deploy/)
  },
)

test(
  'tijdelijke PR72-deploymentroute is volledig verwijderd',
  async () => {
    const source = await workflowSource()
    const preview = jobBlock(source, 'preview-test')
    const deployDb = jobBlock(source, 'deploy-db-test')
    const deploy = jobBlock(source, 'deploy-test')

    assert.doesNotMatch(source, /^\s*pull_request:$/m)
    assert.doesNotMatch(source, /deploy-supabase-test/)
    assert.doesNotMatch(source, /github\.head_ref/)
    assert.doesNotMatch(source, /github\.event\.pull_request/)

    assert.match(
      preview,
      /github\.event_name == 'workflow_dispatch'/,
    )

    assert.match(
      deployDb,
      /github\.event_name == 'workflow_dispatch'/,
    )

    assert.match(
      deploy,
      /github\.event_name == 'workflow_dispatch'/,
    )
  },
)
test(
  'preview-job blijft niet-muterend',
  async () => {
    const source = await workflowSource()
    const preview = jobBlock(source, 'preview-test')

    assert.match(preview, /supabase db push --dry-run/)

    assert.doesNotMatch(
      preview,
      /^        run: supabase db push$/m,
    )

    assert.doesNotMatch(
      preview,
      /supabase functions deploy/,
    )
  },
)

test(
  'validate-job dwingt het workflowcontract zelf af',
  async () => {
    const source = await workflowSource()
    const validate = jobBlock(source, 'validate')

    assert.match(
      validate,
      /node --test tests\/supabase-workflow-contract\.test\.mjs/,
    )
  },
)

test(
  'deployment blijft vast op het afgescheiden TEST-project zonder JWT-bypass',
  async () => {
    const source = await workflowSource()

    assert.match(
      source,
      /SUPABASE_TEST_PROJECT_REF: lldmyfvhjypomxfpltlx/,
    )

    assert.doesNotMatch(source, /--no-verify-jwt/)
  },
)