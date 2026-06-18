import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import db from '../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') return res.status(405).json({ msg: '仅GET' });
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ msg: '未登录' });
    const token = auth.split(' ')[1];
    try {
        jwt.verify(token, process.env.JWT_SECRET!);
    } catch {
        return res.status(401).json({ msg: '登录失效' });
    }

    const { groupId } = req.query;
    const result = await db.query(`
        SELECT u.id, u.username
        FROM group_members gm
        LEFT JOIN users u ON gm.user_id = u.id
        WHERE gm.group_id = $1
    `, [groupId]);
    return res.json(result.rows);
}