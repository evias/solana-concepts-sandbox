const express = require('express');
const path = require('path');
const fs = require('fs');
const swaggerUi = require('swagger-ui-express');
const config = require('./api/config');
const { createLogger } = require('./api/logger');

const app = express();
const bindHost = config.server.bindHost;
const bindPort = config.server.bindPort;
const buildType = config.server.buildType || 'development';
const log = createLogger('http');

// Middleware to parse JSON with increased size limit for file uploads
app.use(express.json({ limit: '5mb' }));

// Serve dashboard landing
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Swagger UI documentation at /docs/v1
try {
  const swaggerFile = path.join(__dirname, 'docs', 'openapi.json');
  if (fs.existsSync(swaggerFile)) {
    const swaggerDocument = JSON.parse(fs.readFileSync(swaggerFile, 'utf-8'));
    app.use('/docs/v1', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
      customCss: '.swagger-ui .topbar { display: none }',
      swaggerOptions: {
        persistAuthorization: true
      }
    }));
    log.info('Swagger UI available at /docs/v1');
  } else {
    log.warn('OpenAPI spec not found at docs/openapi.json. Run: npm run docs:generate');
  }
} catch (error) {
  log.error('Failed to load Swagger UI', { error: error.message });
}

// Logs API routes
const logsApi = require('./api/logs');
app.use('/api/v1/logs', logsApi);

// System API routes
const systemApi = require('./api/system');
app.use('/api/v1/system', systemApi);

// PetTracker API routes
const pettrackerApi = require('./api/pettracker');
app.use('/api/v1/pettracker', pettrackerApi);

// PetVax API routes
const petvaxApi = require('./api/petvax');
app.use('/api/v1/petvax', petvaxApi);

// PetDiet API routes
const petdietApi = require('./api/petdiet');
app.use('/api/v1/petdiet', petdietApi);

// HealthCred API routes
const healthcredApi = require('./api/healthcred');
app.use('/api/v1/healthcred', healthcredApi);

// CareCircle API routes
const carecircleApi = require('./api/carecircle');
app.use('/api/v1/carecircle', carecircleApi);

// HCPConsole API routes
const hcpconsoleApi = require('./api/hcpconsole');
app.use('/api/v1/hcpconsole', hcpconsoleApi);

// Serve individual concept pages
app.get('/pettracker', (req, res) => {
  res.sendFile(path.join(__dirname, 'concepts/pettracker.html'));
});
app.get('/petvax', (req, res) => {
  res.sendFile(path.join(__dirname, 'concepts/petvax.html'));
});
app.get('/petdiet', (req, res) => {
  res.sendFile(path.join(__dirname, 'concepts/petdiet.html'));
});
app.get('/healthcred', (req, res) => {
  res.sendFile(path.join(__dirname, 'concepts/healthcred.html'));
});
app.get('/carecircle', (req, res) => {
  res.sendFile(path.join(__dirname, 'concepts/carecircle.html'));
});
app.get('/hcpconsole', (req, res) => {
  res.sendFile(path.join(__dirname, 'concepts/hcpconsole.html'));
});

// Serve assets
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// Serve documentation files
app.use('/concepts/docs', express.static(path.join(__dirname, 'concepts/docs')));

app.listen(bindPort, bindHost, () => {
  log.info(`Server started in ${buildType} mode`);
  log.info(`Server listening at http://${bindHost}:${bindPort}`);
});
