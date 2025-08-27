// backend/index.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { pool } = require('./db');            // conexão MySQL (pool)
const demandasRouter = require('./routes/demandas'); // rotas de demandas

const app = express();

// Middlewares
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

// Healthcheck (inclui verificação do DB)
app.get('/health', async (_req, res) => {
  try {
    const [r] = await pool.query('SELECT 1 AS ok');
    res.json({ ok: true, db: r[0].ok === 1 });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'DB indisponível' });
  }
});

// Rotas de demandas (prefixo /demanda)
app.use('/demanda', demandasRouter);

// 404 e handler de erro
app.use((req, res) => res.status(404).json({ error: 'Rota não encontrada' }));
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Erro interno' });
});

// Start & shutdown
const PORT = parseInt(process.env.PORT || '3001', 10);
const server = app.listen(PORT, () =>
  console.log(`API Ágora rodando em http://localhost:${PORT}`)
);

async function gracefulExit(signal) {
  console.log(`\n${signal} recebido. Encerrando…`);
  try { await pool.end(); } catch {}
  server.close(() => process.exit(0));
}
process.on('SIGINT', () => gracefulExit('SIGINT'));
process.on('SIGTERM', () => gracefulExit('SIGTERM'));
