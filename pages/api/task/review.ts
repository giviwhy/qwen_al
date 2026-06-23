import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import db from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, msg: '仅支持POST' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, msg: '未登录' });
    }
    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET;

    let loginUserId: string;
    let loginRole: string;
    try {
        const payload = jwt.verify(token, secret!) as { id: string; role: string };
        loginUserId = payload.id;
        loginRole = payload.role;
    } catch {
        return res.status(401).json({ success: false, msg: '登录失效' });
    }

    const { taskId, status, comment } = req.body;

    if (!taskId || !status) {
        return res.status(400).json({ success: false, msg: '缺少必要参数' });
    }

    if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ success: false, msg: '无效的审核状态' });
    }

    try {
        // 检查任务是否存在
        const taskRow = await db.query(
            `SELECT t.*, g.leader_id 
            FROM tasks t 
            JOIN groups g ON t.group_id = g.id 
            WHERE t.id = $1`,
            [taskId]
        );

        if (taskRow.rows.length === 0) {
            return res.status(404).json({ success: false, msg: '任务不存在' });
        }

        const task = taskRow.rows[0];

        // 检查权限：只有管理员或本组组长可以审核
        const isAdmin = loginRole === 'admin';
        const isGroupLeader = task.leader_id === loginUserId;

        if (!isAdmin && !isGroupLeader) {
            return res.status(403).json({ success: false, msg: '无权限审核此任务' });
        }

        // 更新任务审核状态
        const newStatus = status === 'approved' ? 'done' : 'todo';
        await db.query(
            `UPDATE tasks 
            SET review_status = $1, review_comment = $2, reviewer_id = $3, reviewed_at = $4, status = $5
            WHERE id = $6`,
            [status, comment || null, loginUserId, new Date().toISOString(), newStatus, taskId]
        );

        // 如果审核通过，发送通知给任务执行者
        if (status === 'approved' && task.assignee_id) {
            const title = '任务审核通过';
            const content = `您的任务「${task.title}」已通过审核。${comment ? `审核意见：${comment}` : ''}`;

            await db.query(
                `INSERT INTO notifications (title, content, type, group_id, sender_id, recipient_id, is_read)
                VALUES ($1, $2, 'notification', $3, $4, $5, false)`,
                [title, content, task.group_id, loginUserId, task.assignee_id]
            );
        } else if (status === 'rejected' && task.assignee_id) {
            const title = '任务审核未通过';
            const content = `您的任务「${task.title}」未通过审核，请修改后重新提交。${comment ? `审核意见：${comment}` : ''}`;

            await db.query(
                `INSERT INTO notifications (title, content, type, group_id, sender_id, recipient_id, is_read)
                VALUES ($1, $2, 'notification', $3, $4, $5, false)`,
                [title, content, task.group_id, loginUserId, task.assignee_id]
            );
        }

        return res.status(200).json({
            success: true,
            msg: status === 'approved' ? '审核通过' : '已打回任务',
            data: { status, comment }
        });
    } catch (err) {
        console.error('审核任务失败：', err);
        return res.status(500).json({
            success: false,
            msg: '审核任务失败: ' + (err as Error).message
        });
    }
}