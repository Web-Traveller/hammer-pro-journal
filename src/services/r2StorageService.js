/**
 * Direct Cloudflare R2 Storage Service (AWS S3-compatible)
 * Connected to: https://76cdb43cd04ce3235b092defe0eeaeac.r2.cloudflarestorage.com/hammer-pro-journal
 * Supports:
 * 1. Master Journal Snapshot (uploadMasterSnapshot / downloadMasterSnapshot)
 * 2. Raw Log Streaming (uploadRawLogToCloud / downloadRawLogFromCloud)
 * 3. Screenshot Images (uploadScreenshotToCloud / downloadScreenshotFromCloud)
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

export const R2_ACCOUNT_ID = '76cdb43cd04ce3235b092defe0eeaeac';
export const R2_BUCKET = 'hammer-pro-journal';
export const R2_ENDPOINT = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

export const R2_ACCESS_KEY_ID = '46884316eff299e9e1fec432790e90f8';
export const R2_SECRET_ACCESS_KEY = '94b0fe9a0d1e4cbeea0c65722adfc9cea7bf2fae35a4547822d7697adf0e16b5';

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
 */
export async function uploadMasterSnapshot(userId, snapshotData) {
  if (!userId || !snapshotData) return null;
  const key = `users/${userId}/journal_snapshot.json`;

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
export async function downloadMasterSnapshot(userId) {
  if (!userId) return null;
  const key = `users/${userId}/journal_snapshot.json`;

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
    console.warn('R2 download master snapshot note:', err.message);
    return null;
  }
}

/**
 * Upload raw broker log (.txt) to Cloudflare R2
 */
export async function uploadRawLogToCloud(userId, sessionDate, rawLogContent) {
  if (!userId || !sessionDate || !rawLogContent) return null;
  const key = `users/${userId}/logs/${sessionDate}.txt`;

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
export async function downloadRawLogFromCloud(userId, sessionDate) {
  if (!userId || !sessionDate) return null;
  const key = `users/${userId}/logs/${sessionDate}.txt`;

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
    console.warn('R2 download raw log note:', err.message);
    return null;
  }
}

/**
 * Delete raw log file (.txt) from Cloudflare R2
 */
export async function deleteRawLogFromCloud(userId, sessionDate) {
  if (!userId || !sessionDate) return false;
  const key = `users/${userId}/logs/${sessionDate}.txt`;

  try {
    const client = getR2Client();
    const command = new DeleteObjectCommand({
      Bucket: R2_BUCKET,
      Key: key
    });
    await client.send(command);
    console.log(`[Cloudflare R2] Deleted raw log: ${key}`);
    return true;
  } catch (err) {
    console.warn('R2 delete raw log note:', err.message);
    return false;
  }
}

/**
 * Upload compressed screenshot (.jpg) to Cloudflare R2
 */
export async function uploadScreenshotToCloud(userId, sessionDate, filename, dataUrl) {
  if (!userId || !sessionDate || !dataUrl) return null;
  const cleanFilename = filename.endsWith('.jpg') || filename.endsWith('.png') ? filename : `${filename}.jpg`;
  const key = `users/${userId}/screenshots/${sessionDate}/${cleanFilename}`;

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
