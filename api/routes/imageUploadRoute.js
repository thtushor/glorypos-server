const express = require('express');
const ImageUploadHelper = require('../utils/ImageServerice');
const imageController = require('../services/ImageUploadService');
const { AuthService } = require('../services');
const subscriptionLimits = require('../middleware/subscriptionLimits');
const router = express.Router();


// Single image upload
router.post('/upload',
    AuthService.authenticate,
    ImageUploadHelper.getUploadMiddleware(),
    // subscriptionLimits.checkSubscriptionStatus,
    // subscriptionLimits.checkStorageLimit,
    imageController.uploadImage
);

// Multiple images upload
router.post('/upload-multiple',
    AuthService.authenticate,
    ImageUploadHelper.getMultipleUploadMiddleware(),
    // subscriptionLimits.checkSubscriptionStatus,
    // subscriptionLimits.checkStorageLimit,
    imageController.uploadMultipleImages
);

// Delete image
router.post('/delete/:filename',
    AuthService.authenticate,
    imageController.deleteImage
);

module.exports = router; 