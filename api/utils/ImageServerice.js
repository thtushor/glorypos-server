const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const fs = require('fs').promises;

// Configure multer for image upload
const storage = multer.memoryStorage();

// File filter to accept only images
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Not an image! Please upload only images.'), false);
    }
};

// Configure upload with 2MB limit
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 30 * 1024 * 1024, // 2MB limit
    }
});

class ImageUploadHelper {
    static async processAndSaveImage(file, options = {}) {
        try {
            const {
                width = 800,        // Default width
                height = null,      // Maintain aspect ratio by default
                quality = 10,       // Default quality
                format = 'webp',    // Default format
                user
            } = options;

            // Create unique filename
            const filename = `${user.id}_${uuidv4()}.${format}`;

            // Ensure upload directory exists
            const uploadDir = path.join(process.cwd(), 'public', `uploads/${user?.id}`);
            await fs.mkdir(uploadDir, { recursive: true });

            // Process image with sharp
            const processedImage = sharp(file.buffer);

            // Resize if width/height provided
            if (width || height) {
                processedImage.resize(width, height, {
                    fit: 'inside',
                    withoutEnlargement: true
                });
            }

            // Convert to specified format and set quality
            processedImage[format]({ quality });

            // Save the processed image
            const filepath = path.join(uploadDir, filename);
            await processedImage.toFile(filepath);

            // Return the public URL
            return `/uploads/${user.id}/${filename}`;
        } catch (error) {
            console.error('Image processing error:', error);
            throw new Error('Failed to process image');
        }
    }

    static getUploadMiddleware() {
        return upload.single('image');
    }

    static getMultipleUploadMiddleware() {
        return upload.array('images', 10); // Max 10 images
    }
}

module.exports = ImageUploadHelper; 