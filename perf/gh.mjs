import { readFileSync } from 'fs'

const token = process.env.GUEARTH_GH_TOKEN
const repo = 'HikaruQwQ/GuEarth'
const [, , command, ...rest] = process.argv

const headers = {
  accept: 'application/vnd.github+json',
  authorization: `Bearer ${token}`,
  'user-agent': 'GuEarth-Perf-Baseline',
  'x-github-api-version': '2022-11-28'
}

async function api(path, init) {
  const response = await fetch(`https://api.github.com${path}`, { ...init, headers: { ...headers, ...(init?.headers ?? {}) } })
  const text = await response.text()
  if (!response.ok) {
    console.error(`HTTP ${response.status} ${path}`)
    console.error(text.slice(0, 600))
    process.exit(1)
  }
  return text ? JSON.parse(text) : null
}

if (!token) {
  console.error('missing GUEARTH_GH_TOKEN')
  process.exit(1)
}

if (command === 'show') {
  const number = rest[0]
  const issue = await api(`/repos/${repo}/issues/${number}`)
  console.log(`#${issue.number} ${issue.title}`)
  console.log(`state=${issue.state} comments=${issue.comments} labels=${(issue.labels ?? []).map((label) => (typeof label === 'string' ? label : label.name)).join(',')}`)
  console.log('--- body ---')
  console.log(issue.body ?? '(empty)')
  const comments = await api(`/repos/${repo}/issues/${number}/comments?per_page=100`)
  console.log(`--- comments (${comments.length}) ---`)
  for (const comment of comments) {
    console.log(`[${comment.user.login} ${comment.created_at}] id=${comment.id}`)
    console.log((comment.body ?? '').slice(0, 4000))
    console.log('---')
  }
}

if (command === 'comment') {
  const number = rest[0]
  const body = readFileSync(rest[1], 'utf8')
  const created = await api(`/repos/${repo}/issues/${number}/comments`, { method: 'POST', body: JSON.stringify({ body }) })
  console.log(`created comment ${created.id} ${created.html_url}`)
}

if (command === 'edit-body') {
  const number = rest[0]
  const body = readFileSync(rest[1], 'utf8')
  const updated = await api(`/repos/${repo}/issues/${number}`, { method: 'PATCH', body: JSON.stringify({ body }) })
  console.log(`updated issue ${updated.number} body ${updated.body.length} chars`)
}
