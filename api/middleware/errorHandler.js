function errorHandler(err, req, res, next) {
    console.error('Error:', err); // Log error for debugging

    let statusCode = err.statusCode || 500;
    let message = 'Internal Server Error';
    let errors = null;

    // Sequelize Validation Error
    if (err.name === 'SequelizeValidationError') {
        statusCode = 400;
        message = err.errors?.map(e => e.message).join(', ') || 'Validation error occurred';
        errors = err.errors?.map(e => ({
            field: e.path,
            message: e.message,
            value: e.value
        }));
    }
    
    // Sequelize Unique Constraint Error
    else if (err.name === 'SequelizeUniqueConstraintError') {
        statusCode = 409; // Conflict
        const field = err.errors?.[0]?.path;
        const value = err.errors?.[0]?.value;
        
        if (field === 'code') {
            message = `Product code '${value}' already exists`;
        } else if (field === 'sku') {
            message = `SKU '${value}' already exists`;
        } else if (field === 'email') {
            message = `Email '${value}' already exists`;
        } else {
            message = `${field} '${value}' already exists`;
        }
        
        errors = err.errors?.map(e => ({
            field: e.path,
            message: e.message,
            value: e.value
        }));
    }
    
    // Sequelize Foreign Key Constraint Error
    else if (err.name === 'SequelizeForeignKeyConstraintError') {
        statusCode = 400;
        message = 'Invalid reference: Related record does not exist';
    }
    
    // Sequelize Database Error
    else if (err.name === 'SequelizeDatabaseError') {
        statusCode = 400;
        message = 'Database operation failed';
    }
    
    // Sequelize Connection Error
    else if (err.name === 'SequelizeConnectionError') {
        statusCode = 503; // Service Unavailable
        message = 'Database connection failed';
    }
    
    // JWT Authentication Errors
    else if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        message = 'Invalid authentication token';
    }
    else if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        message = 'Authentication token expired';
    }
    
    // Multer File Upload Errors
    else if (err.name === 'MulterError') {
        statusCode = 400;
        if (err.code === 'LIMIT_FILE_SIZE') {
            message = 'File size is too large';
        } else if (err.code === 'LIMIT_FILE_COUNT') {
            message = 'Too many files uploaded';
        } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            message = 'Unexpected file field';
        } else {
            message = err.message || 'File upload error';
        }
    }
    
    // Custom Error Messages
    else if (err.message) {
        message = err.message;
    }
    
    // Handle array of errors from Sequelize
    else if (err.errors && Array.isArray(err.errors)) {
        message = err.errors.map(e => e.message).join(', ');
    }

    // Prepare response
    const response = {
        status: false,
        message: message
    };

    // Include detailed errors in development mode only
    if (process.env.NODE_ENV === 'development' && errors) {
        response.errors = errors;
    }

    // Include stack trace in development mode
    if (process.env.NODE_ENV === 'development') {
        response.stack = err.stack;
    }

    res.status(statusCode).json(response);
}

module.exports = errorHandler;