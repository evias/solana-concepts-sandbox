const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse JSON
app.use(express.json());

// Serve dashboard landing
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

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


app.listen(port, () => {
  console.log(`Concept Sandbox listening at http://localhost:${port}`);
});
