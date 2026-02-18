import AWS from "aws-sdk";
import { v4 as uuidv4 } from "uuid";

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || "us-east-1",
});

export const uploadToS3 = async (buffer, originalName) => {
  try {
    const fileExtension = originalName.split(".").pop() || "jpg";
    const fileName = `food-images/${uuidv4()}.${fileExtension}`;

    const params = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: fileName,
      Body: buffer,
      ContentType: getContentType(fileExtension),
    };

    const result = await s3.upload(params).promise();

    return result.Location;
  } catch (error) {
    console.error("S3 Upload Error:", error);
    throw error;
  }
};

export const getSignedUrl = async (key, expiry = 3600) => {
  try {
    const params = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
      Expires: expiry,
    };

    return await s3.getSignedUrlPromise("getObject", params);
  } catch (error) {
    console.error("Get Signed URL Error:", error);
    throw error;
  }
};

export const deleteFromS3 = async (key) => {
  try {
    const params = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
    };

    await s3.deleteObject(params).promise();
    return true;
  } catch (error) {
    console.error("Delete from S3 Error:", error);
    throw error;
  }
};

const getContentType = (extension) => {
  const types = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    bmp: "image/bmp",
  };

  return types[extension.toLowerCase()] || "application/octet-stream";
};
