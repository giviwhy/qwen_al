import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import db from '../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        // 仅允许 GET
        if (req.method !== 'GET') {
            return res.status(405).json({ success: false, data: [], msg: '仅支持GET请求' });
        }

        // 校验 Authorization
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, data: [], msg: '未登录' });
        }
        const token = authHeader.split(' ')[1];
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            return res.status(500).json({ success: false, data: [], msg: '服务密钥未配置' });
        }

        let payload: { id: string; role: string };
        try {
            payload = jwt.verify(token, secret) as { id: string; role: string };
        } catch (err) {
            console.error('user-leader-groups Token校验失败', err);
            return res.status(401).json({ success: false, data: [], msg: '登录失效' });
        }

        // 查询当前登录用户作为组长的所有小组
        const sql = `
        SELECT g.*, u.username AS leader_name
        FROM groups g
        LEFT JOIN users u ON g.leader_id = u.id
        WHERE g.leader_id = $1
        ORDER BY g.created_at DESC
    `;
        const result = await db.query(sql, [payload.id]);
        return res.status(200).json({
            success: true,
            data: result.rows,
            msg: '查询成功'
        });
    } catch (globalErr) {
        console.error('user-leader-groups 全局未知异常', globalErr);
        return res.status(500).json({ success: false, data: [], msg: '服务器未知错误' });
    }
}