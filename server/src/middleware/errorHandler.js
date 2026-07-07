/** Centralised Express error handler — never leaks stack traces to clients. */
export function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  console.error(`[Veloura] ${req.method} ${req.originalUrl} —`, err);
  const status = err.status || 500;
  res.status(status).json({
    error: err.expose ? err.message : 'Internal server error.',
  });
}

/** Helper to build errors with a safe, client-visible message. */
export function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  err.expose = true;
  return err;
}
