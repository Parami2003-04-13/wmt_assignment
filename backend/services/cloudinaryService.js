const cloudinary = require('cloudinary').v2;

let configured = false;

function ensureConfig() {
  if (configured) return true;
  const name = process.env.CLOUDINARY_CLOUD_NAME;
  const key = process.env.CLOUDINARY_API_KEY;
  const secret = process.env.CLOUDINARY_API_SECRET;
  if (!name || !key || !secret) {
    return false;
  }
  cloudinary.config({
    cloud_name: name,
    api_key: key,
    api_secret: secret,
    secure: true,
  });
  configured = true;
  return true;
}

function isConfigured() {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

/**
 * Upload a Base64/data-URI image to Cloudinary. Pass through remote https URLs unchanged (caller skips those).
 */
async function uploadBufferOrDataUri(dataUri, opts = {}) {
  if (!ensureConfig()) {
    throw new Error('Cloudinary credentials are missing on the server.');
  }

  const folder = typeof opts.folder === 'string' && opts.folder.trim() ? opts.folder.trim() : 'campusbites';

  const result = await cloudinary.uploader.upload(dataUri, {
    folder,
    resource_type: 'auto',
    overwrite: true,
    ...opts.uploadOpts,
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
  };
}

module.exports = {
  isConfigured,
  uploadBufferOrDataUri,
};
