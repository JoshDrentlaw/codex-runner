'use strict'

const crypto = require('crypto')

/**
 * Compare secrets in constant time to avoid timing leaks.
 * Always compares buffers of identical length to keep execution time stable.
 */
function timingSafeEqualString(expected, provided) {
  const expectedBuf = Buffer.from(expected)
  const providedBuf = Buffer.from(provided || '')

  // When lengths differ, compare against a padded buffer to keep timing uniform.
  if (expectedBuf.length !== providedBuf.length) {
    const padded = Buffer.alloc(expectedBuf.length)
    providedBuf.copy(padded)
    crypto.timingSafeEqual(expectedBuf, padded)
    return false
  }

  return crypto.timingSafeEqual(expectedBuf, providedBuf)
}

/**
 * Validate the shared secret token from the request.
 * Separates missing vs invalid for clearer HTTP responses.
 */
function verifyToken(expectedToken, providedToken) {
  if (!expectedToken) {
    return { ok: false, code: 'TOKEN_NOT_CONFIGURED', error: 'Server token is not configured' }
  }

  if (!providedToken) {
    return { ok: false, code: 'MISSING_TOKEN', error: 'Missing X-CODEX-TOKEN header' }
  }

  const matches = timingSafeEqualString(expectedToken, providedToken)
  if (!matches) {
    return { ok: false, code: 'INVALID_TOKEN', error: 'Invalid token' }
  }

  return { ok: true }
}

module.exports = {
  verifyToken,
}
