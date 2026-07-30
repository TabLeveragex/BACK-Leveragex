function formatJoiError(error) {
  if (!error || !error.details?.length) {
    return 'Bad request';
  }
  return error.details.map((d) => d.message).join(', ');
}

function getMissingEnvVars() {
  const required = [
    'MONGO_CONN',
    'JWT_SECRET',
    'HCAPTCHA_SECRET_KEY',
    'SMTP_USER',
    'SMTP_PASS',
  ];
  return required.filter((key) => !String(process.env[key] || '').trim());
}

function logRequiredEnvOnStartup() {
  const missing = getMissingEnvVars();
  if (missing.length) {
    console.error(
      `[Startup] Missing required environment variables: ${missing.join(', ')}`
    );
    process.exit(1);
  }
}

module.exports = {
  formatJoiError,
  getMissingEnvVars,
  logRequiredEnvOnStartup,
};
