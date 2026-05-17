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
app.use('/pettracker', express.static(path.join(__dirname, 'concepts/pettracker.html')));
app.use('/petvax', express.static(path.join(__dirname, 'concepts/petvax.html')));
app.use('/petdiet', express.static(path.join(__dirname, 'concepts/petdiet.html')));
app.use('/healthcred', express.static(path.join(__dirname, 'concepts/healthcred.html')));
app.use('/carecircle', express.static(path.join(__dirname, 'concepts/carecircle.html')));

// Serve assets
app.use('/assets/pettracker', express.static(path.join(__dirname, 'assets/pettracker')));
app.use('/assets/petvax', express.static(path.join(__dirname, 'assets/petvax')));
app.use('/assets/petdiet', express.static(path.join(__dirname, 'assets/petdiet')));
app.use('/assets/healthcred', express.static(path.join(__dirname, 'assets/healthcred')));
app.use('/assets/carecircle', express.static(path.join(__dirname, 'assets/carecircle')));

app.listen(port, () => {
  console.log(`Concept Sandbox listening at http://localhost:${port}`);
});
