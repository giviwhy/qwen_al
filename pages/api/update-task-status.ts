import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import db from '../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, msg: '仅支持POST', data: [] });
    }

    // 鉴权
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, msg: '未登录', data: [] });
    }
    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ success: false, msg: '密钥未配置', data: [] });

    let loginUserId: string;
    try {
        const payload = jwt.verify(token, secret) as { id: string; role: string };
        loginUserId = payload.id;
    } catch {
        return res.status(401).json({ success: false, msg: '登录失效', data: [] });
    }

    const { taskId, status } = req.body;
    if (!taskId || !status) {
        return res.status(400).json({ success: false, msg: '参数缺失', data: [] });
    }

    // 只能修改分配给自己的任务
    const taskRow = await db.query(`SELECT assignee_id FROM tasks WHERE id = $1`, [taskId]);
    if (taskRow.rows.length === 0) {
        return res.status(404).json({ success: false, msg: '任务不存在', data: [] });
    }
    if (taskRow.rows[0].assignee_id !== loginUserId) {
        return res.status(403).json({ success: false, msg: '仅可修改分配给你的任务', data: [] });
    }

    await db.query(`UPDATE tasks SET status = $1 WHERE id = $2`, [status, taskId]);
    return res.status(200).json({ success: true, msg: '状态更新成功', data: [] });
}