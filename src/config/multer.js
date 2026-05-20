const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadPath = path.join(process.cwd(), 'uploads', 'cars');

if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadPath);
  },

  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);

    const fileName =
      Date.now() +
      '-' +
      Math.round(Math.random() * 1e9) +
      ext;

    cb(null, fileName);
  }
});

function fileFilter(req, file, cb) {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/webp'
  ];

  const allowedExtensions = [
    '.jpg',
    '.jpeg',
    '.png',
    '.webp'
  ];

  const ext = path
    .extname(file.originalname)
    .toLowerCase();

  if (!allowedMimeTypes.includes(file.mimetype)) {
    return cb(
      new Error('Разрешены только JPG, PNG и WEBP')
    );
  }

  if (!allowedExtensions.includes(ext)) {
    return cb(
      new Error('Неверный формат файла')
    );
  }

  cb(null, true);
}

const upload = multer({
  storage,

  limits: {
    fileSize: 5 * 1024 * 1024
  },

  fileFilter
});

module.exports = upload;
