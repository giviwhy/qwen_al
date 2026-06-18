import { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../lib/db';
import jwt from 'jsonwebtoken';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // 仅允许GET请求
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, msg: 'Method Not Allowed' });
    }

    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
        return res.status(500).json({ success: false, msg: '服务密钥未配置' });
    }

    // 提取Bearer Token
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
    if (!token) {
        return res.status(401).json({ success: false, msg: 'Unauthorized' });
    }

    try {
        // 校验JWT并解析角色
        const payload = jwt.verify(token, JWT_SECRET) as { role: string };
        // 仅超级管理员可访问
        if (payload.role !== 'admin') {
            return res.status(403).json({ success: false, msg: 'Forbidden：仅管理员可查询' });
        }

        // 查询所有已占用用户ID（组长+组员）
        const sql = `
            SELECT DISTINCT leader_id AS user_id FROM "groups" WHERE leader_id IS NOT NULL
            UNION
            SELECT DISTINCT user_id FROM group_members
        `;
        const result = await pool.query(sql, []);
        const occupiedUserIds = result.rows.map(row => row.user_id);

        return res.status(200).json({
            success: true,
            data: occupiedUserIds
        });
    } catch (err) {
        console.error('查询all-occupied-user-ids接口异常：', err);
        return res.status(401).json({ success: false, msg: 'Token invalid' });
    }
}