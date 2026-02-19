'use strict'

const fs = require('fs/promises')
const path = require('path')
const { spawnWithLimits } = require('./process')

/**
 * Check for git metadata to decide whether diff makes sense.
 * Supports worktrees where .git can be a file.
 */
async function isGitRepo(repoPath) {
  try {
    const gitPath = path.join(repoPath, '.git')
    const stat = await fs.stat(gitPath)
    return stat.isDirectory() || stat.isFile()
  } catch (error) {
    return false
  }
}

/**
 * Run git diff with a bounded output size to avoid huge payloads.
 */
async function runGitDiff(repoPath, maxOutputBytes) {
  return spawnWithLimits('git', ['diff', '--no-color'], {
    cwd: repoPath,
    env: process.env,
    maxOutputBytes,
    timeoutMs: 60000,
  })
}

module.exports = {
  isGitRepo,
  runGitDiff,
}
