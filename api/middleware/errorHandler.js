function errorHandler(err, req, res, next) {
    const statusCode = err.statusCode || 500;
    const message = err?.errors?.map(({ message }) => message)?.join(", ") || err.message || 'Internal Server Error';

    res.status(statusCode).json({ error: message });
}

module.exports = errorHandler; 