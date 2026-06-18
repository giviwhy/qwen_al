import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import db from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') return res.status(405).end();
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).end();
    const token = auth.split(' ')[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { id: string; role: string };
    if (payload.role !== 'admin') return res.status(403).json({ msg: '仅管理员可发送全局通知' });

    const { title, content } = req.body;
    // 查询全部用户
    const allUsers = await db.query('SELECT id FROM users', []);
    const senderId = payload.id;
    // 批量插入全局通知（group_id=null 代表全平台公告）
    for (const u of allUsers.rows) {
        await db.query(`
            INSERT INTO notifications (title,content,type,group_id,sender_id,recipient_id,is_read)
            VALUES ($1,$2,'info',null,$3,$4,false)
        `, [title, content, senderId, u.id]);
    }
    res.json({ success: true, count: allUsers.rows.length });
}