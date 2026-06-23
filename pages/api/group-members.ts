import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import db from '../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        if (req.method !== 'GET') {
            return res.status(405).json({ success: false, data: [], msg: '仅支持GET' });
        }

        const { groupId } = req.query;
        const gid = Array.isArray(groupId) ? groupId[0] : groupId;
        if (!gid) {
            return res.status(400).json({ success: false, data: [], msg: '缺少groupId' });
        }

        const auth = req.headers.authorization;
        if (!auth || !auth.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, data: [], msg: '未登录' });
        }
        const token = auth.split(' ')[1];
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            return res.status(500).json({ success: false, data: [], msg: '密钥未配置' });
        }

        let payload: { id: string; role: string };
        try {
            payload = jwt.verify(token, secret) as { id: string; role: string };
        } catch (err) {
            console.error('Token校验失败', err);
            return res.status(401).json({ success: false, data: [], msg: '登录失效' });
        }

        const result = await db.query(`
        SELECT u.id, u.username, u.role
        FROM group_members gm
        LEFT JOIN users u ON gm.user_id = u.id
        WHERE gm.group_id = $1 AND u.role NOT IN ('leader', 'admin')
    `, [gid]);
        return res.json({ success: true, data: result.rows, msg: '查询成功' });
    } catch (globalErr) {
        console.error('组员接口全局异常', globalErr);
        return res.status(500).json({ success: false, data: [], msg: '服务器未知错误' });
    }
}