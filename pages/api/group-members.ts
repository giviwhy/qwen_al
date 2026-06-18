import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import db from '../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') return res.status(405).json({ success: false, msg: '仅支持GET' });
    const { groupId } = req.query;
    if (!groupId) return res.status(400).json({ success: false, data: [], msg: '缺少groupId' });

    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ success: false, data: [], msg: '未登录' });
    const token = auth.split(' ')[1];

    let payload: { id: string; role: string };
    try {
        payload = jwt.verify(token, process.env.JWT_SECRET!) as { id: string; role: string };
    } catch {
        return res.status(401).json({ success: false, data: [], msg: '登录失效' });
    }

    try {
        const result = await db.query(`
            SELECT u.id, u.username
            FROM group_members gm
            LEFT JOIN users u ON gm.user_id = u.id
            WHERE gm.group_id = $1
        `, [groupId]);
        return res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, data: [], msg: '查询组员失败' });
    }
}