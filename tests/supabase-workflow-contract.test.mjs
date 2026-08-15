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

  assert.notEqual(
    start,
    -1,
    `Job ${jobName} ontbreekt`,
  )

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
  'echte Supabase TEST-deployment vereist expliciete workflow_dispatch',
  async () => {
    const source = await workflowSource()
    const deploy = jobBlock(source, 'deploy-test')

    assert.match(
      deploy,
      /^    if: github\.event_name == 'workflow_dispatch'$/m,
    )

    assert.match(
      deploy,
      /^      - name: Apply database migrations$/m,
    )

    assert.match(
      deploy,
      /^        run: supabase db push$/m,
    )

    assert.match(
      deploy,
      /supabase functions deploy create-member/,
    )

    assert.match(
      deploy,
      /supabase functions deploy resend-member-invite/,
    )
  },
)

test(
  'pull-requestpad mag Supabase TEST alleen previewen',
  async () => {
    const source = await workflowSource()
    const preview = jobBlock(source, 'preview-test')

    assert.match(
      preview,
      /supabase db push --dry-run/,
    )

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
  'handmatige deployment behoudt expliciete bevestigingswaarde',
  async () => {
    const source = await workflowSource()

    assert.match(
      source,
      /^\s*workflow_dispatch:$/m,
    )

    assert.match(
      source,
      /DEPLOY_SUPABASE_TEST/,
    )

    const deploy = jobBlock(source, 'deploy-test')

    assert.match(
      deploy,
      /^    needs: preview-test$/m,
    )
  },
)