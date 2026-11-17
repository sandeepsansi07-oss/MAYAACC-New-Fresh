/**
 * MAYAACC — Step 0: Foundation
 * src/renderer/js/crypto.js — salted SHA-256 (WebCrypto).
 * The password itself is never stored; only salt + hash.
 */
'use strict';

function randomSaltHex() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password, salt) {
  return sha256Hex(salt + ':' + password);
}
