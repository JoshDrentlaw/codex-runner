'use strict'

const express = require('express')
const { config } = require('./config')
const { verifyToken } = require('./security')
const { runCodexJob } = require('./runner')

/**
 * Simple in-memory concurrency gate to prevent overlapping runs.
 */
class ConcurrencyGate {
  constructor(maxConcurrency) {
    this.max = Math.max(1, maxConcurrency || 1)
    this.active = 0
  }

  tryAcquire() {
    if (this.active >= this.max) return null
    this.active += 1

    let released = false
    return () => {
      if (released) return
      released = true
      this.active = Math.max(0, this.active - 1)
    }
  }
}

/**
 * Map validation error codes to HTTP statuses for consistent responses.
 */
function statusForErrorCode(code) {
  const map = {
    INVALID_REPO_PATH: 400,
    REPO_NOT_FOUND: 400,
    REPO_NOT_DIRECTORY: 400,
    REPO_NOT_ALLOWED: 403,
    NO_ALLOWED_ROOTS: 500,
  }

  return map[code] || 400
}

const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: config.bodyLimit }))

const gate = new ConcurrencyGate(config.maxConcurrency)

app.post('/run', async (req, res) => {
  const release = gate.tryAcquire()
  if (!release) {
    return res.status(409).json({ ok: false, error: 'Server is busy', code: 'BUSY' })
  }

  try {
    const tokenResult = verifyToken(config.token, req.get('X-CODEX-TOKEN'))
    if (!tokenResult.ok) {
      const status = tokenResult.code === 'MISSING_TOKEN' ? 401
        : tokenResult.code === 'INVALID_TOKEN' ? 403
          : 500
      return res.status(status).json({ ok: false, error: tokenResult.error, code: tokenResult.code })
    }

    if (!req.is('application/json')) {
      return res.status(400).json({ ok: false, error: 'Content-Type must be application/json', code: 'INVALID_CONTENT_TYPE' })
    }

    const body = req.body || {}
    const repoPath = body.repoPath
    const prompt = body.prompt

    if (!repoPath || typeof repoPath !== 'string') {
      return res.status(400).json({ ok: false, error: 'repoPath is required', code: 'INVALID_REPO_PATH' })
    }

    if (typeof prompt !== 'string') {
      return res.status(400).json({ ok: false, error: 'prompt must be a string', code: 'INVALID_PROMPT' })
    }

    if (prompt.length < 1 || prompt.length > 50000) {
      return res.status(400).json({ ok: false, error: 'prompt length must be 1..50000', code: 'INVALID_PROMPT' })
    }

    const result = await runCodexJob({ repoPath, prompt })
    if (!result.ok) {
      const status = statusForErrorCode(result.code)
      return res.status(status).json({ ok: false, error: result.error, code: result.code })
    }

    return res.status(200).json(result)
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Internal server error', code: 'INTERNAL_ERROR' })
  } finally {
    release()
  }
})

app.listen(config.port, config.host, () => {
  console.log(`codex-runner listening on http://${config.host}:${config.port}`)
})
