const { Storage } = require("@google-cloud/storage");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

const base64Credentials = process.env.GOOGLE_CREDENTIALS_BASE64;
const credentialsPath = path.join(
  __dirname,
  "../credentials/google-credentials.json"
);

fs.writeFileSync(credentialsPath, Buffer.from(base64Credentials, "base64"));

const storage = new Storage({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: credentialsPath,
});

const bucketName = "vol-images";

const uploadUserImageToGCS = async (file, userId) => {
  const bucket = storage.bucket(bucketName);
  const fileName = `${userId}/${Date.now()}-${file.originalname}`;
  const gcsFile = bucket.file(fileName);

  try {
    await gcsFile.save(file.buffer, {
      metadata: {
        contentType: file.mimetype,
      },
    });

    const publicUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;
    return publicUrl;
  } catch (error) {
    console.error("Error uploading image to GCS:", error);
    throw new Error("Failed to upload image");
  }
};

module.exports = { uploadUserImageToGCS };
