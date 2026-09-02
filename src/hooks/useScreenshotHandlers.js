import { useState, useCallback } from 'react';
import { compressScreenshot } from '../utils/imageCompression';
import {
  saveScreenshotsToStorage,
  deleteScreenshotFromStorage
} from '../services/storageService';

export function useScreenshotHandlers({ sessionDate, licenseCheck, showToast, activeAccountId = 'default' }) {
  const [sessionScreenshots, setSessionScreenshots] = useState([]);
  const [activeLightboxImg, setActiveLightboxImg] = useState(null);

  const handleInlineScreenshotSelect = useCallback(async (e) => {
    if (!sessionDate) return;
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const maxAllowed = licenseCheck?.features?.max_screenshots || (licenseCheck?.status === 'trial_active' ? 1 : 999);
    if (sessionScreenshots.length + files.length > maxAllowed) {
      if (showToast) showToast(`Screenshot limit reached (${maxAllowed} per session on your plan).`, 'error');
      return;
    }

    const newImgs = [];
    for (const file of files) {
      try {
        const compressed = await compressScreenshot(file, 1920, 0.82);
        newImgs.push({ filename: `${Date.now()}_${file.name}`, dataUrl: compressed });
      } catch (err) {
        console.warn('Screenshot compression error:', err);
      }
    }

    const updated = [...sessionScreenshots, ...newImgs];
    setSessionScreenshots(updated);
    await saveScreenshotsToStorage(sessionDate, updated);
    if (showToast) showToast("Screenshots compressed & attached to session!", "success");
  }, [sessionDate, sessionScreenshots, licenseCheck, showToast]);

  const handleDeleteSessionScreenshot = useCallback(async (filename) => {
    if (!sessionDate || !filename) return;
    const updated = sessionScreenshots.filter(img => img.filename !== filename);
    setSessionScreenshots(updated);
    await deleteScreenshotFromStorage(sessionDate, filename);
    if (showToast) showToast("Screenshot removed!", "info");
  }, [sessionDate, sessionScreenshots, showToast]);

  return {
    sessionScreenshots,
    setSessionScreenshots,
    activeLightboxImg,
    setActiveLightboxImg,
    handleInlineScreenshotSelect,
    handleDeleteSessionScreenshot
  };
}
