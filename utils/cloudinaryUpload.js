const { cloudinary, isCloudinaryConfigured } = require('../config/cloudinary');
function uploadBuffer(buffer, folder = 'hovira/products') {
  if (!isCloudinaryConfigured()) throw new Error('Cloudinary is not configured. Add CLOUDINARY_* values to .env.');
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder, resource_type: 'image', quality: 'auto', fetch_format: 'auto' }, (error, result) => {
      if (error) return reject(error);
      resolve({ url: result.secure_url, publicId: result.public_id, width: result.width, height: result.height, format: result.format });
    });
    stream.end(buffer);
  });
}
async function deleteImage(publicId) {
  if (!publicId || !isCloudinaryConfigured()) return;
  return cloudinary.uploader.destroy(publicId, { resource_type: 'image', invalidate: true });
}
module.exports = { uploadBuffer, deleteImage };
