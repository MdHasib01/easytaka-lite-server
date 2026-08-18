const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

const getKey = () => {
  const keyHex = process.env.SETTINGS_ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error('SETTINGS_ENCRYPTION_KEY is not set');
  }
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) {
    throw new Error('SETTINGS_ENCRYPTION_KEY must be a 32-byte hex string (64 hex characters)');
  }
  return key;
};

// Encrypts plaintext into "iv:authTag:ciphertext" (all hex), or '' for empty input.
const encrypt = (plaintext) => {
  if (!plaintext) return '';
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
};

// Decrypts a string produced by encrypt(). Returns '' for empty/malformed input.
const decrypt = (payload) => {
  if (!payload) return '';
  const parts = String(payload).split(':');
  if (parts.length !== 3) return '';
  const [ivHex, authTagHex, ciphertextHex] = parts;
  const key = getKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, 'hex')),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
};

module.exports = { encrypt, decrypt };
