import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import db from '../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'PUT') return res.status(405).end();
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).end();
    const token = auth.split(' ')[1];

    let payload: { id: string; role: string };
    try {
        payload = jwt.verify(token, process.env.JWT_SECRET!) as { id: string; role: string };
    } catch {
        return res.status(401).end();
    }
    if (payload.role !== 'admin') return res.status(403).end();

    const { groupId, userId, newRole } = req.body;
    // 修改小组组长
    if (newRole === 'leader') {
        await db.query('UPDATE groups SET leader_id = $1 WHERE id = $2', [userId, groupId]);
    }
    // 修改用户全局角色
    await db.query('UPDATE users SET role = $1 WHERE id = $2', [newRole, userId]);
    res.json({ success: true });
}