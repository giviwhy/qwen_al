import { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../lib/db';
import { getTokenFromHeader, verifyToken } from '../../utils/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') return res.status(405).json({ msg: 'Method Not Allowed' });
    // 鉴权
    const token = getTokenFromHeader(req);
    if (!token) return res.status(401).json({ msg: 'Unauthorized' });
    const payload = await verifyToken(token);
    if (!payload || payload.role !== 'admin') return res.status(403).json({ msg: 'Forbidden' });

    try {
        // PostgreSQL 查询所有组长+组员ID并去重
        const sql = `
            SELECT DISTINCT leader_id AS user_id FROM "groups" WHERE leader_id IS NOT NULL
            UNION
            SELECT DISTINCT user_id FROM group_members
        `;
        const result = await pool.query(sql);
        const userIds = result.rows.map(row => row.user_id);
        return res.status(200).json({ data: userIds });
    } catch (err) {
        return res.status(500).json({ msg: 'DB query error' });
    }
}