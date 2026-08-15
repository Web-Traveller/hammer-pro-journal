/**
 * High-Speed Cryptographic SHA-256 Checksum Utility
 * Uses native Web Crypto API (SubtleCrypto)
 */
export async function computeContentHash(content) {
  if (!content) return '';
  const text = typeof content === 'string' ? content : JSON.stringify(content);
  
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const msgBuffer = new TextEncoder().encode(text);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hashHex;
    } catch (e) {
      console.warn("SubtleCrypto fallback:", e);
    }
  }

  // Fast DJB2 fallback if WebCrypto is unavailable
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash) + text.charCodeAt(i);
    hash = hash & hash;
  }
  return 'djb2_' + Math.abs(hash).toString(16);
}
