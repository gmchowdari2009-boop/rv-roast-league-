const path = require('path');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { attachUser } = require('./auth');

const app = express();
app.use(cors());
app.use(express.json({ limit: '200kb' }));
app.use(attachUser);

app.use('/api/auth', require('./routes/auth'));
app.use('/api/branches', require('./routes/branches'));
app.use('/api/roasts', require('./routes/roasts'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/admin', require('./routes/admin'));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Serve the frontend
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Central error handler so an unexpected exception returns JSON, not an HTML crash page.
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`RV Roast League server running on port ${PORT}`));
