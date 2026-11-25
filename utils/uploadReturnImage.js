
const { cloudinary, isCloudinaryConfigured } = require("../config/cloudinary");

function uploadReturnImage(fileBuffer) {
  return new Promise((resolve, reject) => {
    if (!isCloudinaryConfigured()) {
      return reject(new Error("Cloudinary is not configured."));
    }

    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "hovira/returns",
        resource_type: "image",
      },
      (error, result) => {
        if (error) return reject(error);

        resolve({
          url: result.secure_url,
          publicId: result.public_id,
        });
      }
    );

    stream.end(fileBuffer);
  });
}

module.exports = uploadReturnImage;
