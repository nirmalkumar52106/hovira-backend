
const multer = require("multer");

const storage = multer.memoryStorage();

const allowedTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
];

const uploadReturnImages = multer({
  storage,

  fileFilter: (req, file, cb) => {
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(
        new Error("Only JPG, PNG, WEBP and AVIF images are allowed.")
      );
    }

    cb(null, true);
  },

  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 5,
  },
});

module.exports = uploadReturnImages;
