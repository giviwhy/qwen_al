import { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../lib/db';
import jwt from 'jsonwebtoken';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') return res.status(405).json({ msg: 'Method Not Allowed' });

    // 手动提取token
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
    if (!token) return res.status(401).json({ msg: 'Unauthorized' });

    try {
        // 校验JWT
        const payload = jwt.verify(token, process.env.JWT_SECRET!) as { role: string };
        if (!payload || payload.role !== 'admin') return res.status(403).json({ msg: 'Forbidden' });

        const sql = `
            SELECT DISTINCT leader_id AS user_id FROM "groups" WHERE leader_id IS NOT NULL
            UNION
            SELECT DISTINCT user_id FROM group_members
        `;
        // 关键修复：补充第二个空参数数组
        const result = await pool.query(sql, []);
        const userIds = result.rows.map(row => row.user_id);
        return res.status(200).json({ data: userIds });
    } catch (err) {
        return res.status(401).json({ msg: 'Token invalid' });
    }
}