import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import db from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, data: [], msg: '仅支持GET请求' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ success: false, data: [], msg: '未登录' });
    }
    const token = authHeader.split(' ')[1];

    try {
        jwt.verify(token, process.env.JWT_SECRET!);
    } catch (err) {
        console.error('token校验失败', err);
        return res.status(401).json({ success: false, data: [], msg: '登录失效' });
    }

    const { groupId } = req.query;
    if (!groupId || typeof groupId !== 'string') {
        return res.status(400).json({ success: false, data: [], msg: '小组ID无效' });
    }

    try {
        const sql = `
      SELECT u.id, u.username
      FROM group_members gm
      JOIN users u ON gm.user_id = u.id
      WHERE gm.group_id = $1
    `;
        const result = await db.query(sql, [groupId]);
        return res.json(result.rows);
    } catch (sqlErr) {
        console.error('group-members SQL异常', sqlErr);
        return res.status(500).json({ success: false, data: [], msg: '数据库查询失败' });
    }
}