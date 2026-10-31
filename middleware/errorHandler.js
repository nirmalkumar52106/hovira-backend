function notFound(req, res, next) {
  res.status(404);
  next(new Error(`Route not found: ${req.method} ${req.originalUrl}`));
}
function errorHandler(err, req, res, next) {
  let status = err.statusCode || (res.statusCode && res.statusCode !== 200 ? res.statusCode : 500);
  let message = err.message || 'Internal server error';
  if (err.type === 'entity.too.large') { status = 413; message = 'Request content is too large. Reduce the product content or image size and try again.'; }
  if (err.name === 'ValidationError') { status = 400; message = Object.values(err.errors).map(e => e.message).join(', '); }
  if (err.name === 'CastError') { status = 400; message = `Invalid ${err.path}`; }
  if (err.code === 11000) { status = 409; message = `Duplicate value for ${Object.keys(err.keyValue || {}).join(', ')}`; }
  if (err.name === 'MulterError') {
    status = 400;
    if (err.code === 'LIMIT_FILE_SIZE') message = 'Image must be 10 MB or smaller.';
    else if (err.code === 'LIMIT_FIELD_VALUE') message = 'Product content fields must be 5 MB or smaller.';
    else message = err.message;
  }
  if (process.env.NODE_ENV !== 'production') console.error(err);
  res.status(status).json({
    message,
    ...(process.env.NODE_ENV !== 'production' ? { stack: err.stack } : {}),
  });
}
module.exports = { notFound, errorHandler };
