// api/upload.js (CommonJS)
const { verifyToken, getToken, cors, ok, err } = require('./_lib');
const crypto = require('crypto');

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

  const user = await verifyToken(getToken(req));
  if (!user) return err(res, 'Unauthorised', 401);

  const { image } = req.body || {};
  if (!image) return err(res, 'image required');
  if (!image.startsWith('data:image/')) return err(res, 'Invalid image format');
  if (image.length > 1000000) return err(res, 'Image too large. Max 750KB.');

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey    = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return err(res, 'Cloudinary not configured', 500);

  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const folder    = 'squadra';
    const publicId  = 'avatars/' + user.sub;
    const sigStr    = 'folder=' + folder + '&public_id=' + publicId + '&timestamp=' + timestamp + apiSecret;
    const signature = crypto.createHash('sha1').update(sigStr).digest('hex');

    const formData = new URLSearchParams();
    formData.append('file',      image);
    formData.append('api_key',   apiKey);
    formData.append('timestamp', String(timestamp));
    formData.append('signature', signature);
    formData.append('folder',    folder);
    formData.append('public_id', publicId);
    formData.append('overwrite', 'true');

    const response = await fetch(
      'https://api.cloudinary.com/v1_1/' + cloudName + '/image/upload',
      { method: 'POST', body: formData }
    );
    const data = await response.json();
    if (data.error) return err(res, data.error.message, 400);
    return ok(res, { url: data.secure_url });
  } catch (e) {
    return err(res, e.message, 500);
  }
};