module.exports = function override(config, env) {
  // Remove CSP headers in development
  if (env === 'development') {
    config.devServer = {
      ...config.devServer,
      headers: {
        ...config.devServer?.headers,
        'Content-Security-Policy': "default-src 'self' 'unsafe-eval' 'unsafe-inline' https:; connect-src 'self' https://api.openai.com ws://localhost:*;"
      }
    };
  }
  return config;
};