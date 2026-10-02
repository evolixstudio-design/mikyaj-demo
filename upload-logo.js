const cloudinary = require('cloudinary').v2;
require('dotenv').config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

cloudinary.uploader.upload('mikyaj_logo.png', { public_id: 'mikyaj_logo' })
  .then(res => { console.log('Uploaded logo:', res.secure_url); })
  .catch(err => { console.error('Upload failed:', err); });
