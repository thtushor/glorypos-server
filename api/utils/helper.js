const path = require("path");
const fs = require("fs")

// Helper functions
function parseStorageSize(sizeString) {
    const size = parseFloat(sizeString);
    const unit = sizeString.replace(/[\d.]/g, '').trim().toUpperCase();

    const units = {
        'B': 1,
        'KB': 1024,
        'MB': 1024 * 1024,
        'GB': 1024 * 1024 * 1024
    };

    return size * units[unit];
}

async function calculateUserStorage(userId) {
    // Calculate total storage used from all uploaded files
    try {
        const uploadDir = path.join(__dirname, `../../public/uploads/${userId}`);
        let totalSize = 0;

        const files = await fs.promises.readdir(uploadDir);
        for (const file of files) {

            if (file.startsWith(userId + '_')) {
                const stats = await fs.promises.stat(path.join(uploadDir, file));
                totalSize += stats.size;
            }
        }

        return totalSize;
    } catch (error) {
        throw Error(error)
    }
}


module.exports = {
    parseStorageSize,
    calculateUserStorage
}