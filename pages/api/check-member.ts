import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import db from '../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') return res.status(405).json({ msg: '仅支持GET请求' });
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ msg: '未登录' });
    const token = auth.split(' ')[1];
    try {
        jwt.verify(token, process.env.JWT_SECRET!);
    } catch {
        return res.status(401).json({ msg: '登录已失效' });
    }
    const { groupId, userId } = req.query;
    const result = await db.query(
        'SELECT id FROM group_members WHERE group_id = $1 AND user_id = $2',
        [groupId, userId]
    );
    return res.json({ isMember: result.rows.length > 0 });
}