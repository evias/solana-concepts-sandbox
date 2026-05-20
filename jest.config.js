module.exports = {
  testEnvironment: 'node',
  silent: true,
  transformIgnorePatterns: [
    'node_modules/(?!(rpc-websockets|uuid|@solana|tweetnacl|bn\\.js|borsh)/)'
  ],
  collectCoverageFrom: [
    'api/**/*.js',
    '!api/**/*.test.js'
  ]
};
