const multer = require('multer');
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const storage = multer.memoryStorage();
function imageFilter(req, file, cb) {
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.mimetype)) {
    return cb(new Error('Only JPG, PNG, WEBP and AVIF images are allowed.'));
  }
  cb(null, true);
}
const upload = multer({ storage, fileFilter: imageFilter, limits: { fileSize: MAX_FILE_SIZE, files: 12 } });
module.exports = upload;
