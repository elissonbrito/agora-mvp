// backend/routes/demandas.js
const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Criar nova demanda
router.post('/nova', async (req, res) => {
  try {
    const { titulo, descricao, tipo, id_usuario } = req.body;
    if (!titulo || !descricao || !tipo) {
      return res.status(400).json({ error: 'Campos obrigatórios: titulo, descricao, tipo' });
    }
    const now = Date.now().toString();
    const protocolo = `AG-${new Date().getFullYear()}-${now.slice(-6)}`;

    await pool.execute(
      `INSERT INTO demandas (titulo, descricao, tipo, protocolo, id_usuario)
       VALUES (?,?,?,?,?)`,
      [titulo, descricao, tipo, protocolo, id_usuario ?? null]
    );

    res.status(201).json({ protocolo, message: 'Demanda registrada com sucesso.' });
  } catch (e) {
    console.error('Erro POST /demanda/nova:', e);
    res.status(500).json({ error: 'Erro ao criar demanda' });
  }
});

// Listar demandas (com paginação e filtros opcionais)
router.get('/listar', async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize || '20', 10), 1), 100);
    const offset = (page - 1) * pageSize;

    const { status, tipo, search } = req.query;
    const where = [];
    const params = [];

    if (status) { where.push('status = ?'); params.push(status); }
    if (tipo)   { where.push('tipo = ?');   params.push(tipo); }
    if (search) {
      where.push('(titulo LIKE ? OR descricao LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [rows] = await pool.query(
      `SELECT id, titulo, tipo, status, protocolo, id_usuario, id_setor, created_at
       FROM demandas
       ${whereSql}
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM demandas ${whereSql}`,
      params
    );

    res.json({ page, pageSize, total, data: rows });
  } catch (e) {
    console.error('Erro GET /demanda/listar:', e);
    res.status(500).json({ error: 'Erro ao listar demandas' });
  }
});

// Atualizar status
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const valid = ['Recebida','Em análise','Em andamento','Concluída'];
    if (!valid.includes(status)) {
      return res.status(400).json({ error: 'Status inválido' });
    }
    const [result] = await pool.execute(
      'UPDATE demandas SET status = ? WHERE id = ?',
      [status, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Demanda não encontrada' });
    }
    res.json({ ok: true, id, status });
  } catch (e) {
    console.error('Erro PUT /demanda/:id/status:', e);
    res.status(500).json({ error: 'Erro ao atualizar status' });
  }
});

module.exports = router;
