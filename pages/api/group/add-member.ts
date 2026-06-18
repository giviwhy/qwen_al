import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import db from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') return res.status(405).end();
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).end();
    const token = auth.split(' ')[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { id: string; role: string };
    if (payload.role !== 'admin') return res.status(403).json({ msg: '仅管理员可添加组员' });

    const { groupId, userId } = req.body;
    // 防止重复加入
    await db.query(`
        INSERT INTO group_members (group_id, user_id)
        VALUES ($1,$2)
        ON CONFLICT DO NOTHING
    `, [groupId, userId]);
    res.json({ success: true });
}