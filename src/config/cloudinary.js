const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'bmiez0ep',
  api_key: process.env.CLOUDINARY_API_KEY || '724651262621461',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'JyZ2syXQv01AoOR-94OHtkvjlj8',
  secure: true,
});

module.exports = cloudinary;
