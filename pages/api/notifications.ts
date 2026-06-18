import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import db from '../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // 限制请求方法
    if (req.method !== 'GET') {
        return res.status(405).json({
            success: false,
            msg: '仅支持GET请求获取通知列表',
            data: []
        });
    }

    const authHeader = req.headers.authorization;
    // 校验标准Bearer Token格式
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            msg: '未登录或Token格式错误',
            data: []
        });
    }
    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        return res.status(500).json({
            success: false,
            msg: '服务密钥未配置',
            data: []
        });
    }

    let userId: string;
    try {
        // 解析Token
        const payload = jwt.verify(token, secret) as { id: string };
        userId = payload.id;
    } catch (err) {
        console.error('通知接口Token校验失败：', err);
        return res.status(401).json({
            success: false,
            msg: '登录已失效，请重新登录',
            data: []
        });
    }

    try {
        // 查询当前用户所有通知，关联发送者用户名
        const result = await db.query(`
            SELECT n.*, u.username as sender_name
            FROM notifications n
            LEFT JOIN users u ON n.sender_id = u.id
            WHERE n.recipient_id = $1
            ORDER BY n.created_at DESC
        `, [userId]);

        // 关键优化：兜底空数组，防止rows为null传给前端
        return res.status(200).json({
            success: true,
            msg: '通知查询成功',
            data: result.rows || []
        });
    } catch (dbErr) {
        console.error('查询通知数据库异常：', dbErr);
        return res.status(500).json({
            success: false,
            msg: '服务器读取通知失败',
            data: []
        });
    }
}