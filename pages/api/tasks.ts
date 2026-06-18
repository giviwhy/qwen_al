import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import db from '../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ success: false, data: [] });
    const token = authHeader.split(' ')[1];
    try {
        jwt.verify(token, process.env.JWT_SECRET!);
    } catch {
        return res.status(401).json({ success: false, data: [] });
    }

    if (req.method === 'GET') {
        const { groupId } = req.query;
        try {
            const rows = await db.query(`
        SELECT t.*, u.username as assignee_name, c.username as creator_name
        FROM tasks t
        LEFT JOIN users u ON t.assigned_to = u.id
        LEFT JOIN users c ON t.created_by = c.id
        WHERE t.group_id = $1
        ORDER BY t.created_at DESC
      `, [groupId]);
            return res.json(rows.rows);
        } catch (e) {
            console.error('tasks查询错误', e);
            return res.status(500).json({ success: false, data: [], msg: '读取任务失败' });
        }
    }

    // POST创建任务逻辑保留你原有代码，外层包try-catch
    if (req.method === 'POST') {
        try {
            // 你的原有插入SQL
            return res.json({ success: true });
        } catch (e) {
            console.error('创建任务错误', e);
            return res.status(500).json({ success: false, msg: '创建任务失败' });
        }
    }

    return res.status(405).json({ success: false, msg: '不支持该请求方式' });
}