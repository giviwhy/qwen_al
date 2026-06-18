import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import db from '../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') return res.status(405).json({ success: false, msg: '仅GET', data: [] });

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ success: false, msg: '未登录', data: [] });
    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ success: false, msg: '密钥未配置', data: [] });

    let userId: string;
    try {
        const payload = jwt.verify(token, secret) as { id: string };
        userId = payload.id;
    } catch {
        return res.status(401).json({ success: false, msg: '登录失效', data: [] });
    }

    // 查询该用户所有小组
    const result = await db.query(`
    SELECT DISTINCT g.id, g.name, g.description
    FROM group_members gm
    LEFT JOIN groups g ON gm.group_id = g.id
    WHERE gm.user_id = $1
  `, [userId]);

    return res.status(200).json({ success: true, data: result.rows });
}