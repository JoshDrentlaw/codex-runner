'use strict'

const fs = require('fs/promises')
const path = require('path')
const { config } = require('./config')
const { spawnWithLimits } = require('./process')
const { isGitRepo, runGitDiff } = require('./git')

/**
 * Build codex CLI arguments in one place for easy changes.
 */
function buildCodexArgs(prompt) {
  // Use non-interactive exec mode to avoid TTY requirements.
  const baseArgs = ['exec', '--full-auto']

  // Allow simple space-separated extra args for local customization.
  const extraArgs = config.codexExecArgs
    ? config.codexExecArgs.split(/\s+/).filter(Boolean)
    : []

  return [...baseArgs, ...extraArgs, prompt]
}

/**
 * Resolve allowlist roots with real paths to prevent symlink escapes.
 */
async function resolveAllowedRoots() {
  const resolved = []

  for (const root of config.allowedRoots) {
    try {
      const realRoot = await fs.realpath(root)
      resolved.push(realRoot)
    } catch (error) {
      // Ignore missing roots to avoid blocking all requests.
    }
  }

  return resolved
}

/**
 * Ensure the repo path exists, is a directory, and is under an allowlist root.
 */
async function validateRepoPath(repoPath) {
  if (!repoPath || typeof repoPath !== 'string') {
    return { ok: false, code: 'INVALID_REPO_PATH', error: 'repoPath must be a string' }
  }

  let repoRealPath
  try {
    repoRealPath = await fs.realpath(repoPath)
  } catch (error) {
    return { ok: false, code: 'REPO_NOT_FOUND', error: 'repoPath does not exist' }
  }

  let stats
  try {
    stats = await fs.stat(repoRealPath)
  } catch (error) {
    return { ok: false, code: 'REPO_NOT_FOUND', error: 'repoPath does not exist' }
  }

  if (!stats.isDirectory()) {
    return { ok: false, code: 'REPO_NOT_DIRECTORY', error: 'repoPath is not a directory' }
  }

  const allowedRoots = await resolveAllowedRoots()
  if (allowedRoots.length === 0) {
    return { ok: false, code: 'NO_ALLOWED_ROOTS', error: 'No valid allowed roots configured' }
  }

  const allowed = allowedRoots.some((root) => {
    if (repoRealPath === root) return true
    return repoRealPath.startsWith(root + path.sep)
  })

  if (!allowed) {
    return { ok: false, code: 'REPO_NOT_ALLOWED', error: 'repoPath is outside allowed roots' }
  }

  return { ok: true, repoRealPath }
}

/**
 * Execute codex, then capture a git diff if available.
 */
async function runCodexJob({ repoPath, prompt }) {
  const validation = await validateRepoPath(repoPath)
  if (!validation.ok) return validation

  const repoRealPath = validation.repoRealPath
  const startedAt = new Date()

  const codexResult = await spawnWithLimits('codex', buildCodexArgs(prompt), {
    cwd: repoRealPath,
    env: process.env,
    timeoutMs: config.codexTimeoutMs,
    maxOutputBytes: config.maxOutputBytes,
  })

  const gitRepo = await isGitRepo(repoRealPath)
  let diffResult = { stdout: '', stderr: '', exitCode: 0, timedOut: false, truncated: false }

  if (gitRepo) {
    diffResult = await runGitDiff(repoRealPath, config.maxOutputBytes)
  }

  const finishedAt = new Date()

  return {
    ok: true,
    repoPath: repoRealPath,
    gitRepo,
    exitCode: codexResult.exitCode,
    timedOut: codexResult.timedOut,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    stdout: codexResult.stdout,
    stderr: codexResult.stderr,
    diff: gitRepo ? diffResult.stdout : '',
    diffExitCode: gitRepo ? diffResult.exitCode : 0,
    truncated: codexResult.truncated,
    diffTruncated: gitRepo ? diffResult.truncated : false,
  }
}

module.exports = {
  runCodexJob,
  validateRepoPath,
  buildCodexArgs,
}
