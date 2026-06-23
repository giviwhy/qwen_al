import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import db from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') return res.status(405).json({ success: false, msg: '仅支持POST' });

    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ success: false, msg: '未登录' });
    const token = auth.split(' ')[1];

    let payload: { id: string; role: string };
    try {
        payload = jwt.verify(token, process.env.JWT_SECRET!) as { id: string; role: string };
    } catch {
        return res.status(401).json({ success: false, msg: '登录失效' });
    }
    if (payload.role !== 'admin') return res.status(403).json({ success: false, msg: '仅管理员可操作' });

    const { groupId, userIds } = req.body;
    if (!groupId || !Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ success: false, msg: '参数错误' });
    }

    try {
        // 批量插入，使用 UNNEST 一次性插入所有用户，冲突跳过
        const values = userIds.map((uid, index) => `($1, $${index + 2})`).join(', ');
        const params = [groupId, ...userIds];
        
        await db.query(`
            INSERT INTO group_members (group_id, user_id)
            VALUES ${values}
            ON CONFLICT DO NOTHING
        `, params);
        
        return res.json({ success: true, msg: '批量添加组员成功' });
    } catch (err) {
        console.error('批量添加组员失败', err);
        return res.status(500).json({ success: false, msg: '服务器错误' });
    }
}