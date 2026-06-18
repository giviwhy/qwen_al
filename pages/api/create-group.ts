import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import db from '../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') return res.status(405).end();
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).end();
    const token = auth.split(' ')[1];

    let payload: { id: string; role: string };
    try {
        payload = jwt.verify(token, process.env.JWT_SECRET!) as { id: string; role: string };
    } catch {
        return res.status(401).json({ msg: '登录失效' });
    }

    if (payload.role !== 'admin') {
        return res.status(403).json({ msg: '仅管理员可创建小组' });
    }

    const { name, description } = req.body;
    const insertRes = await db.query(`
    INSERT INTO groups (name, description, admin_id, leader_id)
    VALUES ($1, $2, $3, $3)
    RETURNING *
  `, [name, description, payload.id]);

    const leaderInfo = await db.query('SELECT username FROM users WHERE id = $1', [payload.id]);
    const groupData = insertRes.rows[0];
    groupData.leader_name = leaderInfo.rows[0].username;
    res.json(groupData);
}