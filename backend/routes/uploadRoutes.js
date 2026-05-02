const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { isConfigured, uploadBufferOrDataUri } = require('../services/cloudinaryService');

function sanitizeFolder(raw) {
  if (typeof raw !== 'string' || !raw.trim()) {
    return 'campusbites';
  }
  const s = raw
    .trim()
    .replace(/[^a-zA-Z0-9/_\-]/g, '')
    .replace(/^\/+|\/+$/g, '')
    .slice(0, 120);
  return s.length ? `campusbites/${s}` : 'campusbites';
}

router.post('/image', protect, async (req, res) => {
  try {
    if (!isConfigured()) {
      return res.status(503).json({
        message:
          'Image upload is unavailable: configure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.',
      });
    }

    const { image, folder } = req.body || {};

    if (typeof image !== 'string' || !image.trim()) {
      return res.status(400).json({ message: 'Missing image payload' });
    }

    const trimmed = image.trim();

    const isDataUri =
      trimmed.startsWith('data:image') || trimmed.startsWith('data:application/octet-stream');
    if (!isDataUri) {
      return res.status(400).json({
        message: 'Image must be sent as a data URI (base64).',
      });
    }

    if (trimmed.length > 12 * 1024 * 1024) {
      return res.status(413).json({ message: 'Image is too large. Try a smaller photo.' });
    }

    const folderPath = sanitizeFolder(folder);
    const { url } = await uploadBufferOrDataUri(trimmed, { folder: folderPath });

    res.json({ url });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ message: err.message || 'Upload failed' });
  }
});

module.exports = router;
