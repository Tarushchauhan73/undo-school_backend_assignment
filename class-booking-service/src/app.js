require('dotenv').config();
const express = require('express');
const helmet  = require('helmet');
const cors    = require('cors');
const routes  = require('./routes');
const { errorHandler } = require('./middleware/errorHandler');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use('/api/v1', routes);
app.use((req, res) => res.status(404).json({ success: false, code: 'NOT_FOUND', message: `${req.method} ${req.originalUrl} not found.` }));
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`\n  Class Booking API  ->  http://localhost:${PORT}/api/v1\n`);
});
module.exports = app;