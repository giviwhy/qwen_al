import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import db from '../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // 仅允许GET请求
    if (req.method !== 'GET') {
        return res.status(405).json({
            success: false,
            msg: '仅支持GET请求获取小组列表',
            data: []
        });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({
            success: false,
            msg: '未登录，请先登录',
            data: []
        });
    }
    const token = authHeader.split(' ')[1];

    try {
        // 校验token有效性
        jwt.verify(token, process.env.JWT_SECRET!);

        // 关联users表获取组长用户名 leader_name
        const sql = `
            SELECT g.*, u.username AS leader_name
            FROM groups g
            LEFT JOIN users u ON g.leader_id = u.id
            ORDER BY g.created_at DESC
        `;
        const result = await db.query(sql, []);

        return res.json({
            success: true,
            data: result.rows
        });
    } catch (err) {
        console.error('获取小组列表接口鉴权/数据库异常：', err);
        return res.status(401).json({
            success: false,
            msg: '登录已失效，请重新登录',
            data: []
        });
    }
}