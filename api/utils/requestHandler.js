function requestHandler(middleware, requestCallback) {
    return async (req, res, next) => {
        try {
            if (middleware) {
                await middleware(req, res, next);
            }
            await requestCallback(req, res, next);
        } catch (error) {
            next(error);
        }
    };
}

module.exports = requestHandler; 