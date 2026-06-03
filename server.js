const express = require('express');
const path = require('path');
const config = require('./api/config');
const { createLogger } = require('./api/logger');

const app = express();
const bindHost = config.server.bindHost;
const bindPort = config.server.bindPort;
const log = createLogger('http');

// Middleware to parse JSON with increased size limit for file uploads
app.use(express.json({ limit: '5mb' }));

// Serve dashboard landing
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Logs API routes
const logsApi = require('./api/logs');
app.use('/api/v1/logs', logsApi);

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

// Serve assets
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// Serve documentation files
app.use('/concepts/docs', express.static(path.join(__dirname, 'concepts/docs')));


app.listen(bindPort, bindHost, () => {
  log.info(`Server listening at http://${bindHost}:${bindPort}`);
});
