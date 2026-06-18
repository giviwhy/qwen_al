import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import db from '../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // 仅允许GET请求
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, msg: '仅支持GET请求' });
    }

    const authHeader = req.headers.authorization;
    // 无token直接返回未登录
    if (!authHeader) {
        return res.status(401).json({ success: false, msg: '未登录，请前往登录页' });
    }
    const token = authHeader.split(' ')[1];

    try {
        // 解析JWT拿到用户ID
        const payload = jwt.verify(token, process.env.JWT_SECRET!) as { id: string };
        // 查询用户
        const userRes = await db.query('SELECT id, username, role FROM users WHERE id = $1', [payload.id]);
        const user = userRes.rows[0];
        // 用户不存在
        if (!user) {
            return res.status(401).json({ success: false, msg: '用户不存在' });
        }
        // 正常返回用户信息
        return res.json({ success: true, data: user });
    } catch (err) {
        console.error('校验token失败：', err);
        // token过期/篡改统一返回登录失效
        return res.status(401).json({ success: false, msg: '登录已失效，请重新登录' });
    }
}