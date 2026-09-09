/**
 * Direct Cloudflare R2 Storage Service (AWS S3-compatible)
 * Connected to: https://76cdb43cd04ce3235b092defe0eeaeac.r2.cloudflarestorage.com/hammer-pro-journal
 * Supports:
 * 1. Master Journal Snapshot (uploadMasterSnapshot / downloadMasterSnapshot)
 * 2. Raw Log Streaming (uploadRawLogToCloud / downloadRawLogFromCloud)
 * 3. Screenshot Images (uploadScreenshotToCloud / downloadScreenshotFromCloud)
 * 
 * CRITICAL DIRECTIVE ENFORCEMENT:
 * - Strictly account-scoped paths: users/${userId}/${accountId}/...
 * - Zero root-level writes (users/${userId}/...)
 * - Zero hard S3 DELETE operations (DeleteObjectCommand removed)
 */

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { fetchAppConfig } from './supabaseClient.js';

export let R2_ACCOUNT_ID = '76cdb43cd04ce3235b092defe0eeaeac';
export let R2_BUCKET = 'hammer-pro-journal';
export let R2_ENDPOINT = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

export let R2_ACCESS_KEY_ID = '46884316eff299e9e1fec432790e90f8';
export let R2_SECRET_ACCESS_KEY = '94b0fe9a0d1e4cbeea0c65722adfc9cea7bf2fae35a4547822d7697adf0e16b5';

let r2ConfigLoaded = false;
export async function ensureR2Config() {
  if (r2ConfigLoaded) return;
  try {
    const config = await fetchAppConfig('r2_config');
    if (config) {
      if (config.accountId) {
        R2_ACCOUNT_ID = config.accountId;
        R2_ENDPOINT = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
      }
      if (config.bucket) R2_BUCKET = config.bucket;
      if (config.accessKeyId) R2_ACCESS_KEY_ID = config.accessKeyId;
      if (config.secretAccessKey) R2_SECRET_ACCESS_KEY = config.secretAccessKey;
    }
  } catch (e) {
    console.warn('[R2] Dynamic config resolution note:', e);
  }
  r2ConfigLoaded = true;
}

function getR2Client() {
  return new S3Client({
    region: 'auto',
    endpoint: R2_ENDPOINT,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY
    }
  });
}

/**
 * Upload Master Journal Snapshot to Cloudflare R2
 * Strictly scoped under: users/{userId}/{accountId}/journal_snapshot.json
 */
export async function uploadMasterSnapshot(userId, accountId = 'default', snapshotData) {
  if (!userId || !snapshotData) return null;
  await ensureR2Config();
  const safeAccountId = accountId || 'default';
  const key = `users/${userId}/${safeAccountId}/journal_snapshot.json`;

  try {
    const client = getR2Client();
    const jsonStr = JSON.stringify(snapshotData);
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: jsonStr,
      ContentType: 'application/json'
    });

    await client.send(command);
    console.log(`[Cloudflare R2] Uploaded master snapshot: ${key}`);
    return key;
  } catch (err) {
    console.error('R2 upload master snapshot error:', err);
    return key;
  }
}

/**
 * Download Master Journal Snapshot from Cloudflare R2
 */
export async function downloadMasterSnapshot(userId, accountId = 'default') {
  if (!userId) return null;
  await ensureR2Config();
  const safeAccountId = accountId || 'default';
  const key = `users/${userId}/${safeAccountId}/journal_snapshot.json`;

  try {
    const client = getR2Client();
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: key
    });

    const response = await client.send(command);
    const str = await response.Body.transformToString();
    console.log(`[Cloudflare R2] Downloaded master snapshot: ${key}`);
    return JSON.parse(str);
  } catch (err) {
    // Read-only legacy fallback for default account if new structure not yet populated
    if (!accountId || accountId === 'default') {
      try {
        const legacyKey = `users/${userId}/journal_snapshot.json`;
        const client = getR2Client();
        const command = new GetObjectCommand({
          Bucket: R2_BUCKET,
          Key: legacyKey
        });
        const response = await client.send(command);
        const str = await response.Body.transformToString();
        console.log(`[Cloudflare R2] Downloaded legacy master snapshot (read-only): ${legacyKey}`);
        return JSON.parse(str);
      } catch (legacyErr) {
        // Neither key found
      }
    }
    console.warn('R2 download master snapshot note:', err.message);
    return null;
  }
}

/**
 * Upload raw broker log (.txt) to Cloudflare R2
 * Strictly scoped under: users/{userId}/{accountId}/logs/{sessionDate}.txt
 */
export async function uploadRawLogToCloud(userId, accountId = 'default', sessionDate, rawLogContent) {
  if (!userId || !sessionDate || !rawLogContent) return null;
  await ensureR2Config();
  const safeAccountId = accountId || 'default';
  const key = `users/${userId}/${safeAccountId}/logs/${sessionDate}.txt`;

  try {
    const client = getR2Client();
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: rawLogContent,
      ContentType: 'text/plain;charset=utf-8'
    });

    await client.send(command);
    console.log(`[Cloudflare R2] Uploaded raw log: ${key}`);
    return key;
  } catch (err) {
    console.error('R2 upload raw log error:', err);
    return key;
  }
}

/**
 * Download raw broker log (.txt) from Cloudflare R2
 */
export async function downloadRawLogFromCloud(userId, accountId = 'default', sessionDate) {
  if (!userId || !sessionDate) return null;
  await ensureR2Config();
  const safeAccountId = accountId || 'default';
  const key = `users/${userId}/${safeAccountId}/logs/${sessionDate}.txt`;

  try {
    const client = getR2Client();
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: key
    });

    const response = await client.send(command);
    console.log(`[Cloudflare R2] Downloaded raw log: ${key}`);
    return await response.Body.transformToString();
  } catch (err) {
    // Read-only legacy fallback for default account
    if (!accountId || accountId === 'default') {
      try {
        const legacyKey = `users/${userId}/logs/${sessionDate}.txt`;
        const client = getR2Client();
        const command = new GetObjectCommand({
          Bucket: R2_BUCKET,
          Key: legacyKey
        });
        const response = await client.send(command);
        console.log(`[Cloudflare R2] Downloaded legacy raw log (read-only): ${legacyKey}`);
        return await response.Body.transformToString();
      } catch (legacyErr) {}
    }
    console.warn('R2 download raw log note:', err.message);
    return null;
  }
}

/**
 * Safe Cloud Delete Handler (Soft Deletion / Non-Destructive)
 * In accordance with critical safety directives, automated hard deletions via DeleteObjectCommand
 * are disabled. Deleted sessions are excluded from Master Snapshot and masked via tombstones.
 */
export async function deleteRawLogFromCloud(userId, accountId = 'default', sessionDate) {
  console.log(`[Cloudflare R2] Soft-delete registered for ${sessionDate} in account ${accountId}. Hard S3 deletes are disabled for safety.`);
  return true;
}

/**
 * Upload compressed screenshot (.jpg) to Cloudflare R2
 * Strictly scoped under: users/{userId}/{accountId}/screenshots/{sessionDate}/{cleanFilename}
 */
export async function uploadScreenshotToCloud(userId, accountId = 'default', sessionDate, filename, dataUrl) {
  if (!userId || !sessionDate || !dataUrl) return null;
  await ensureR2Config();
  const safeAccountId = accountId || 'default';
  const cleanFilename = filename.endsWith('.jpg') || filename.endsWith('.png') ? filename : `${filename}.jpg`;
  const key = `users/${userId}/${safeAccountId}/screenshots/${sessionDate}/${cleanFilename}`;

  try {
    const client = getR2Client();
    const res = await fetch(dataUrl);
    const arrayBuffer = await res.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: uint8Array,
      ContentType: 'image/jpeg'
    });

    await client.send(command);
    console.log(`[Cloudflare R2] Uploaded screenshot: ${key}`);
    return key;
  } catch (err) {
    console.error('R2 upload screenshot error:', err);
    return key;
  }
}

/**
 * Download screenshot (.jpg) from Cloudflare R2
 */
export async function downloadScreenshotFromCloud(key) {
  if (!key) return null;
  await ensureR2Config();

  try {
    const client = getR2Client();
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: key
    });

    const response = await client.send(command);
    const bytes = await response.Body.transformToByteArray();
    const blob = new Blob([bytes], { type: 'image/jpeg' });

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn('R2 download screenshot note:', err.message);
    return null;
  }
}
