import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import db from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') return res.status(405).json({ success: false, msg: '仅POST', data: [] });

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ success: false, msg: '未登录', data: [] });
    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET;
    let userId: string;
    try {
        const payload = jwt.verify(token, secret!) as { id: string };
        userId = payload.id;
    } catch {
        return res.status(401).json({ success: false, msg: '登录失效', data: [] });
    }

    const { notifyId } = req.body;
    if (!notifyId) return res.status(400).json({ success: false, msg: '缺少通知ID', data: [] });

    await db.query(`
    INSERT INTO notification_read (notification_id, user_id)
    VALUES ($1, $2)
    ON CONFLICT (notification_id, user_id) DO NOTHING
  `, [notifyId, userId]);

    return res.status(200).json({ success: true, msg: '已读', data: [] });
}