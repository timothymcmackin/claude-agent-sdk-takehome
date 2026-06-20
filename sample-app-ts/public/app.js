// ── State ──────────────────────────────────────────────────────────────────
let currentUser = 'sam'
let activeSessionId = null
let forkSourceSessionId = null
let activeSSE = null

// ── Init ───────────────────────────────────────────────────────────────────
document.querySelectorAll('.user-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    currentUser = btn.dataset.user
    document.querySelectorAll('.user-btn').forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
    activeSessionId = null
    resetChat()
    loadSessions()
  })
})

document.getElementById('new-session-btn').addEventListener('click', async () => {
  await loadBranchList()
  document.getElementById('branch-input').value = ''
  document.getElementById('new-session-dialog').showModal()
})

document.getElementById('create-session-btn').addEventListener('click', async () => {
  const branchName = document.getElementById('branch-input').value.trim()
  if (!branchName) return alert('Enter a branch name')
  document.getElementById('new-session-dialog').close()
  await startNewSession(branchName)
})

document.getElementById('confirm-fork-btn').addEventListener('click', async () => {
  const newBranchName = document.getElementById('fork-branch-input').value.trim()
  if (!newBranchName) return alert('Enter a branch name')
  document.getElementById('fork-dialog').close()
  await forkSession(forkSourceSessionId, newBranchName)
})

document.getElementById('prompt-form').addEventListener('submit', async (e) => {
  e.preventDefault()
  const input = document.getElementById('prompt-input')
  const prompt = input.value.trim()
  if (!prompt || !activeSessionId) return
  input.value = ''
  await sendMessage(prompt)
})

// Allow Shift+Enter for newline, Enter to submit
document.getElementById('prompt-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    document.getElementById('prompt-form').dispatchEvent(new Event('submit'))
  }
})

// ── API helpers ─────────────────────────────────────────────────────────────
async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } }
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(path, opts)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || res.statusText)
  }
  return res.json()
}

// ── Sessions ────────────────────────────────────────────────────────────────
async function loadSessions() {
  const list = document.getElementById('session-list')
  list.innerHTML = '<p class="empty-state">Loading…</p>'
  try {
    const sessions = await api('GET', `/api/sessions?userId=${currentUser}`)
    renderSessions(sessions)
  } catch (err) {
    list.innerHTML = `<p class="empty-state" style="color:#f87171">${err.message}</p>`
  }
}

function renderSessions(sessions) {
  const list = document.getElementById('session-list')
  if (!sessions.length) {
    list.innerHTML = '<p class="empty-state">No sessions yet — create one above</p>'
    return
  }
  list.innerHTML = ''
  sessions.forEach(s => list.appendChild(buildCard(s)))
}

function buildCard(s) {
  const card = document.createElement('div')
  card.className = 'session-card' + (s.sessionId === activeSessionId ? ' active' : '')
  card.dataset.sessionId = s.sessionId

  const title = s.title || `Session ${s.sessionId.slice(0, 8)}`
  const ago = timeAgo(s.lastModified)
  const visClass = s.visibility === 'public' ? 'public' : 'private'
  const visLabel = s.visibility === 'public' ? '🌐 Public' : '🔒 Private'

  card.innerHTML = `
    <div class="session-card-top">
      <div class="session-title" title="${title}">${title}</div>
      ${s.isOwner ? `<span class="visibility-badge ${visClass}" title="Toggle visibility">${visLabel}</span>` : `<span class="visibility-badge ${visClass}">${visLabel}</span>`}
    </div>
    <div class="session-branch">⎇ ${s.branchName}</div>
    <div class="session-meta">
      <span>${ago}</span>
      ${!s.isOwner ? `<span class="session-owner">by ${s.ownerUserId}</span>` : ''}
    </div>
    <div class="session-actions">
      <button class="action-btn resume-btn">Resume</button>
      <button class="action-btn fork-btn">Fork</button>
      ${s.isOwner ? `<button class="action-btn rename-btn">Rename</button>` : ''}
      ${s.isOwner ? `<button class="action-btn danger delete-btn">Delete</button>` : ''}
    </div>
  `

  card.querySelector('.resume-btn').addEventListener('click', (e) => {
    e.stopPropagation()
    openSession(s)
  })
  card.querySelector('.fork-btn').addEventListener('click', (e) => {
    e.stopPropagation()
    openForkDialog(s)
  })
  if (s.isOwner) {
    card.querySelector('.visibility-badge').addEventListener('click', (e) => {
      e.stopPropagation()
      toggleVisibility(s)
    })
    card.querySelector('.rename-btn').addEventListener('click', (e) => {
      e.stopPropagation()
      renameSession(s)
    })
    card.querySelector('.delete-btn').addEventListener('click', (e) => {
      e.stopPropagation()
      deleteSession(s)
    })
  }
  card.addEventListener('click', () => openSession(s))
  return card
}

// ── Chat ────────────────────────────────────────────────────────────────────
function openSession(s) {
  activeSessionId = s.sessionId
  document.getElementById('chat-title').textContent = s.title || `Session ${s.sessionId.slice(0, 8)}`
  document.getElementById('chat-branch').textContent = `⎇ ${s.branchName}`
  document.getElementById('messages').innerHTML = ''
  document.getElementById('prompt-input').disabled = false
  document.getElementById('send-btn').disabled = false
  document.querySelectorAll('.session-card').forEach(c => {
    c.classList.toggle('active', c.dataset.sessionId === s.sessionId)
  })

  // Load history
  loadHistory(s.sessionId)
}

async function loadHistory(sessionId) {
  try {
    const messages = await api('GET', `/api/sessions/${sessionId}/messages?userId=${currentUser}`)
    const container = document.getElementById('messages')
    container.innerHTML = ''
    messages.forEach(m => {
      if (m.type === 'user') appendMessage('user', extractText(m.message))
      else if (m.type === 'assistant') appendMessage('assistant', extractText(m.message))
    })
    scrollToBottom()
  } catch (err) {
    console.warn('Could not load history:', err.message)
  }
}

async function startNewSession(branchName) {
  const placeholder = document.createElement('div')
  placeholder.className = 'message system'
  placeholder.textContent = `Creating session on branch "${branchName}"…`
  document.getElementById('messages').appendChild(placeholder)

  try {
    const { sessionId } = await api('POST', '/api/query', {
      userId: currentUser,
      prompt: `You are a coding assistant helping develop the Recipe Manager API. The project is already initialized. Briefly introduce yourself and describe the current state of the branch.`,
      branchName,
    })
    placeholder.remove()
    const session = { sessionId, branchName, title: null, ownerUserId: currentUser, visibility: 'private', isOwner: true, lastModified: Date.now() }
    activeSessionId = sessionId
    document.getElementById('chat-title').textContent = `Session ${sessionId.slice(0, 8)}`
    document.getElementById('chat-branch').textContent = `⎇ ${branchName}`
    document.getElementById('prompt-input').disabled = false
    document.getElementById('send-btn').disabled = false
    connectSSE(sessionId)
    await loadSessions()
  } catch (err) {
    placeholder.textContent = `Error: ${err.message}`
    placeholder.style.color = '#f87171'
  }
}

async function sendMessage(prompt) {
  appendMessage('user', prompt)
  appendMessage('system', 'Thinking…', 'thinking-indicator')
  setSending(true)

  try {
    const body = { userId: currentUser, prompt, resumeSessionId: activeSessionId }
    const { sessionId } = await api('POST', '/api/query', body)
    connectSSE(sessionId)
  } catch (err) {
    removePlaceholder('thinking-indicator')
    appendMessage('error', err.message)
    setSending(false)
  }
}

function connectSSE(sessionId) {
  if (activeSSE) activeSSE.close()
  activeSSE = new EventSource(`/api/stream/${sessionId}`)

  activeSSE.onmessage = (e) => {
    const msg = JSON.parse(e.data)
    handleStreamMessage(msg)
  }
  activeSSE.onerror = () => {
    activeSSE.close()
    activeSSE = null
    removePlaceholder('thinking-indicator')
    setSending(false)
  }
}

function handleStreamMessage(msg) {
  if (msg.type === 'done') {
    removePlaceholder('thinking-indicator')
    setSending(false)
    if (activeSSE) { activeSSE.close(); activeSSE = null }
    loadSessions()
    return
  }
  if (msg.type === 'error') {
    removePlaceholder('thinking-indicator')
    appendMessage('error', msg.error)
    setSending(false)
    return
  }
  if (msg.type === 'assistant') {
    removePlaceholder('thinking-indicator')
    const text = extractText(msg.message)
    if (text) appendMessage('assistant', text)
  }
  if (msg.type === 'tool_use' || (msg.type === 'system' && msg.subtype === 'tool_result')) {
    const label = msg.name ? `[${msg.name}]` : '[tool]'
    const content = JSON.stringify(msg.input ?? msg.content ?? '', null, 2)
    if (content && content !== '""') appendMessage('tool', `${label}\n${content}`)
  }
}

// ── Session operations ───────────────────────────────────────────────────────
async function toggleVisibility(s) {
  const next = s.visibility === 'public' ? 'private' : 'public'
  try {
    await api('PATCH', `/api/sessions/${s.sessionId}/visibility`, { userId: currentUser, visibility: next })
    loadSessions()
  } catch (err) {
    alert(err.message)
  }
}

async function renameSession(s) {
  const title = prompt('New session title:', s.title || '')
  if (!title) return
  try {
    await api('PATCH', `/api/sessions/${s.sessionId}/rename`, { userId: currentUser, title })
    loadSessions()
  } catch (err) {
    alert(err.message)
  }
}

async function deleteSession(s) {
  if (!confirm('Delete this session and its branch? This cannot be undone.')) return
  try {
    await api('DELETE', `/api/sessions/${s.sessionId}?userId=${currentUser}`)
    if (activeSessionId === s.sessionId) resetChat()
    loadSessions()
  } catch (err) {
    alert(err.message)
  }
}

function openForkDialog(s) {
  forkSourceSessionId = s.sessionId
  document.getElementById('fork-branch-input').value = `${s.branchName}-fork`
  document.getElementById('fork-dialog').showModal()
}

async function forkSession(sessionId, newBranchName) {
  try {
    const { sessionId: forkId, branchName } = await api('POST', `/api/sessions/${sessionId}/fork`, {
      userId: currentUser,
      newBranchName,
    })
    loadSessions()
    openSession({ sessionId: forkId, branchName, title: null, ownerUserId: currentUser, isOwner: true, visibility: 'private', lastModified: Date.now() })
  } catch (err) {
    alert(err.message)
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────
async function loadBranchList() {
  const datalist = document.getElementById('branch-datalist')
  datalist.innerHTML = ''
  try {
    const branches = await api('GET', '/api/branches')
    branches.forEach(b => {
      const opt = document.createElement('option')
      opt.value = b
      datalist.appendChild(opt)
    })
  } catch (_) {}
}

function appendMessage(role, text, id) {
  const el = document.createElement('div')
  el.className = `message ${role}`
  if (id) el.id = id
  el.textContent = text
  document.getElementById('messages').appendChild(el)
  scrollToBottom()
}

function removePlaceholder(id) {
  const el = document.getElementById(id)
  if (el) el.remove()
}

function setSending(on) {
  document.getElementById('send-btn').disabled = on
  document.getElementById('prompt-input').disabled = on
}

function resetChat() {
  activeSessionId = null
  document.getElementById('messages').innerHTML = ''
  document.getElementById('chat-title').textContent = 'Select a session or start a new one'
  document.getElementById('chat-branch').textContent = ''
  document.getElementById('prompt-input').disabled = true
  document.getElementById('send-btn').disabled = true
}

function scrollToBottom() {
  const el = document.getElementById('messages')
  el.scrollTop = el.scrollHeight
}

function extractText(message) {
  if (!message) return ''
  if (typeof message === 'string') return message
  if (Array.isArray(message.content)) {
    return message.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n')
  }
  if (typeof message.content === 'string') return message.content
  return JSON.stringify(message)
}

function timeAgo(ms) {
  if (!ms) return ''
  const diff = Date.now() - ms
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

// ── Boot ─────────────────────────────────────────────────────────────────────
loadSessions()
