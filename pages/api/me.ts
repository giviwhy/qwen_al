import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import db from '../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, msg: '仅支持GET请求' });
    }
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, msg: '未登录或Token格式错误' });
    }
    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ success: false, msg: '服务密钥未配置' });

    let userId: string;
    try {
        const payload = jwt.verify(token, secret) as { id: string };
        userId = payload.id;
    } catch (err) {
        console.error('Token解析失败', err);
        return res.status(401).json({ success: false, msg: '登录已失效，请重新登录' });
    }

    try {
        const userRes = await db.query('SELECT id, username, role FROM users WHERE id = $1', [userId]);
        const user = userRes.rows.at(0);
        if (!user) {
            return res.status(401).json({ success: false, msg: '该用户不存在，请重新登录' });
        }
        return res.status(200).json({ success: true, msg: '获取用户信息成功', data: user });
    } catch (dbErr) {
        console.error('查询用户数据库异常', dbErr);
        return res.status(500).json({ success: false, msg: '服务器读取用户信息失败' });
    }
}