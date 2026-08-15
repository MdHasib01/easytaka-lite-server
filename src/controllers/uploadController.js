const cloudinary = require('../config/cloudinary');

// Upload single image (screenshot or avatar) to Cloudinary
exports.uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const folder = req.body.folder || 'esytaka_proofs';
    const b64 = Buffer.from(req.file.buffer).toString('base64');
    const dataURI = `data:${req.file.mimetype};base64,${b64}`;

    const result = await cloudinary.uploader.upload(dataURI, {
      folder,
      resource_type: 'image',
      transformation: [{ quality: 'auto', fetch_format: 'auto' }],
    });

    return res.json({
      success: true,
      message: 'Image uploaded successfully!',
      url: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      width: result.width,
      height: result.height,
    });
  } catch (error) {
    console.error('Upload controller error:', error);
    return res.status(500).json({ success: false, message: 'Image upload failed: ' + error.message });
  }
};
