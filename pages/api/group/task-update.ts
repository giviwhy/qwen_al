import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import db from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, msg: '仅支持POST' });
    }

    // 登录鉴权
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, msg: '未登录' });
    }
    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ success: false, msg: '密钥未配置' });

    let loginUserId: string;
    let loginRole: string;
    try {
        const payload = jwt.verify(token, secret) as { id: string; role: string };
        loginUserId = payload.id;
        loginRole = payload.role;
    } catch (err) {
        console.error('token错误', err);
        return res.status(401).json({ success: false, msg: '登录失效' });
    }

    const { taskId, title, description, assignedTo, status, dueDate, priority } = req.body;
    if (!taskId) {
        return res.status(400).json({ success: false, msg: '缺少taskId' });
    }

    try {
        // 1. 反查任务所属小组，校验权限
        const taskGroupRes = await db.query(`
      SELECT g.id group_id, g.leader_id, t.group_id
      FROM tasks t
      LEFT JOIN groups g ON t.group_id = g.id
      WHERE t.id = $1
    `, [taskId]);

        if (taskGroupRes.rows.length === 0) {
            return res.status(404).json({ success: false, msg: '任务不存在' });
        }
        const { leader_id, group_id } = taskGroupRes.rows[0];
        const isAdmin = loginRole === 'admin';
        const isLeader = leader_id === loginUserId;

        if (!isAdmin && !isLeader) {
            return res.status(403).json({ success: false, msg: '无权限修改该任务' });
        }

        // 2. 如果更换分配人，校验此人属于本组
        if (assignedTo) {
            const memberCheck = await db.query(`
        SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2
      `, [group_id, assignedTo]);
            if (memberCheck.rows.length === 0) {
                return res.status(400).json({ success: false, msg: '只能分配本组内成员' });
            }
        }

        // 3. 更新任务
        const updateRes = await db.query(`
      UPDATE tasks
      SET
        title = $1,
        description = $2,
        assigned_to = $3,
        status = $4,
        due_date = $5,
        priority = $6
      WHERE id = $7
      RETURNING *
    `, [
            title?.trim() || null,
            description || null,
            assignedTo || null,
            status || 'todo',
            dueDate || null,
            priority || 'medium',
            taskId
        ]);

        return res.status(200).json({ success: true, msg: '修改成功', data: updateRes.rows[0] });
    } catch (e) {
        console.error('修改任务异常', e);
        return res.status(500).json({ success: false, msg: '服务器错误' });
    }
}