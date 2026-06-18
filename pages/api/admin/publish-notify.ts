import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import db from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') return res.status(405).json({ success: false, msg: '仅POST', data: [] });

    // 仅管理员放行
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ success: false, msg: '未登录', data: [] });
    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET;
    let userId: string, role: string;
    try {
        // 修复：添加! 避免secret为undefined类型报错
        const payload = jwt.verify(token, secret!) as { id: string; role: string };
        userId = payload.id;
        role = payload.role;
    } catch {
        return res.status(401).json({ success: false, msg: '登录失效', data: [] });
    }
    if (role !== 'admin') return res.status(403).json({ success: false, msg: '仅管理员发布通知', data: [] });

    const { title, content, groupId } = req.body;
    if (!title || !content) return res.status(400).json({ success: false, msg: '标题/内容不能为空', data: [] });

    // 修复：替换为真实表名 notifications
    const insert = await db.query(`
    INSERT INTO notifications (title, content, type, group_id, sender_id)
    VALUES ($1, $2, 'info', $3, $4) RETURNING *
  `, [title, content, groupId || null, userId]);

    return res.status(201).json({ success: true, msg: '发布成功', data: insert.rows[0] });
}