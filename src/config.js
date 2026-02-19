'use strict'

const path = require('path')
const dotenv = require('dotenv')

// Load .env defaults without overwriting explicit CLI env vars.
dotenv.config()

/**
 * Parse a colon-separated allowlist and fall back to the default root.
 * Using a string split keeps the env format shell-friendly.
 */
function parseAllowedRoots(envValue) {
  const raw = envValue && envValue.trim().length > 0 ? envValue : '/var/www/html/'
  return raw.split(':').map((entry) => entry.trim()).filter(Boolean)
}

/**
 * Coerce numeric env vars while preserving a safe fallback.
 */
function toPositiveInt(value, fallback) {
  const n = Number.parseInt(value, 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

/**
 * Centralized configuration so behavior changes stay in one place.
 */
const config = {
  port: toPositiveInt(process.env.PORT, 8787),
  // Always bind to loopback for safety and ignore external HOST overrides.
  host: '127.0.0.1',
  token: process.env.CODEX_TOKEN || '',
  allowedRoots: parseAllowedRoots(process.env.ALLOWED_REPO_ROOTS),
  // Optional extra args to pass to `codex exec` (space-separated).
  codexExecArgs: process.env.CODEX_EXEC_ARGS || '',
  codexTimeoutMs: toPositiveInt(process.env.CODEX_TIMEOUT_MS, 600000),
  maxOutputBytes: toPositiveInt(process.env.MAX_OUTPUT_BYTES, 2000000),
  maxConcurrency: toPositiveInt(process.env.MAX_CONCURRENCY, 1),
  // Keep bodies small to reduce accidental large payloads.
  bodyLimit: '256kb',
}

/**
 * Allow only absolute roots to avoid ambiguous resolution.
 */
function normalizeRoot(rootPath) {
  if (!rootPath || typeof rootPath !== 'string') return null
  if (!path.isAbsolute(rootPath)) return null
  return rootPath
}

config.allowedRoots = config.allowedRoots.map(normalizeRoot).filter(Boolean)

module.exports = {
  config,
}
