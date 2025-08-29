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

// PUT /demanda/:id/encaminhar  { "id_setor": 3 }
router.put('/:id/encaminhar', async (req, res) => {
  try {
    const { id } = req.params;
    const { id_setor } = req.body;

    if (!id_setor) return res.status(400).json({ error: 'id_setor é obrigatório' });

    // Confere se a demanda existe
    const [d] = await pool.query('SELECT id FROM demandas WHERE id = ?', [id]);
    if (d.length === 0) return res.status(404).json({ error: 'Demanda não encontrada' });

    // Confere se o setor existe
    const [s] = await pool.query('SELECT id FROM setores WHERE id = ?', [id_setor]);
    if (s.length === 0) return res.status(400).json({ error: 'id_setor inválido (setor não existe)' });

    // Atualiza demanda (id_setor) e opcionalmente status
    await pool.execute('UPDATE demandas SET id_setor = ?, status = ? WHERE id = ?', [id_setor, 'Em análise', id]);

    res.json({ ok: true, id: Number(id), id_setor: Number(id_setor), status: 'Em análise' });
  } catch (e) {
    console.error('Erro PUT /demanda/:id/encaminhar:', e);
    res.status(500).json({ error: 'Erro ao encaminhar demanda' });
  }
});

module.exports = router;
