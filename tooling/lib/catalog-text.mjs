// Reject hidden direction overrides and controls while retaining ordinary multilingual text.
const unsafeControls = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/u;
export function validateCatalogText(value, label, maxLength = 3600) {
  if (typeof value !== 'string' || value.length > maxLength || unsafeControls.test(value)) {
    throw new Error(`${label}: invalid catalog text`);
  }
  return value;
}

export async function readTranslationResponse(response) {
  const chunks = []; let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > 256 * 1024) throw new Error('Translation response exceeds limit');
    chunks.push(chunk);
  }
  const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (!Array.isArray(data) || !Array.isArray(data[0]) || data[0].some(row => !Array.isArray(row) || typeof row[0] !== 'string')) {
    throw new Error('Invalid translation response');
  }
  return data[0].map(row => row[0]).join('');
}
