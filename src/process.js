'use strict'

const { spawn } = require('child_process')

/**
 * Attempt to terminate a process tree for long-running commands.
 * Uses a process group on POSIX and a best-effort kill elsewhere.
 */
function terminateProcess(child) {
  if (!child || child.killed) return

  if (process.platform !== 'win32' && child.pid) {
    try {
      process.kill(-child.pid, 'SIGTERM')
      return
    } catch (error) {
      // Fall back to direct kill if process group kill fails.
    }
  }

  try {
    child.kill('SIGTERM')
  } catch (error) {
    // Ignore errors from already-exited processes.
  }
}

/**
 * Spawn a command with timeout and output limits.
 * Returns stdout/stderr strings and metadata.
 */
function spawnWithLimits(command, args, options) {
  const {
    cwd,
    env,
    timeoutMs,
    maxOutputBytes,
  } = options

  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
    })

    let stdout = ''
    let stderr = ''
    let totalBytes = 0
    let truncated = false
    let timedOut = false
    let resolved = false

    const appendChunk = (chunk, target) => {
      if (!chunk || chunk.length === 0) return target
      if (maxOutputBytes <= 0) return target

      const remaining = maxOutputBytes - totalBytes
      if (remaining <= 0) {
        truncated = true
        return target
      }

      const slice = chunk.length > remaining ? chunk.subarray(0, remaining) : chunk
      totalBytes += slice.length
      if (slice.length < chunk.length) truncated = true
      return target + slice.toString('utf8')
    }

    const onTimeout = () => {
      timedOut = true
      terminateProcess(child)
    }

    const timer = timeoutMs ? setTimeout(onTimeout, timeoutMs) : null

    child.stdout.on('data', (chunk) => {
      stdout = appendChunk(chunk, stdout)
    })

    child.stderr.on('data', (chunk) => {
      stderr = appendChunk(chunk, stderr)
    })

    child.on('error', (error) => {
      stderr = appendChunk(Buffer.from(String(error)), stderr)
    })

    child.on('close', (code, signal) => {
      if (resolved) return
      resolved = true
      if (timer) clearTimeout(timer)

      const exitCode = code !== null ? code : (signal ? 1 : null)
      resolve({ stdout, stderr, exitCode, timedOut, truncated })
    })
  })
}

module.exports = {
  spawnWithLimits,
  terminateProcess,
}
