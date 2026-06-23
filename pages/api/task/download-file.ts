import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import db from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, msg: '仅支持GET' });
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

    const { taskId, fileId } = req.query;
    
    if (!taskId || !fileId) {
        return res.status(400).json({ success: false, msg: '缺少必要参数' });
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

        // 检查权限：管理员、本组组长或任务执行者可以下载
        const isAdmin = loginRole === 'admin';
        const isGroupLeader = task.leader_id === loginUserId;
        const isAssignee = task.assignee_id === loginUserId;
        
        if (!isAdmin && !isGroupLeader && !isAssignee) {
            return res.status(403).json({ success: false, msg: '无权限下载此文件' });
        }

        // 获取文件列表
        const files = task.uploaded_files ? JSON.parse(task.uploaded_files) : [];
        const file = files.find((f: { id: string }) => f.id === fileId);
        
        if (!file) {
            return res.status(404).json({ success: false, msg: '文件不存在' });
        }

        return res.status(200).json({
            success: true,
            msg: '文件获取成功',
            data: {
                name: file.name,
                content: file.content,
                uploadedAt: file.uploadedAt
            }
        });
    } catch (err) {
        console.error('下载文件失败：', err);
        return res.status(500).json({
            success: false,
            msg: '下载文件失败: ' + (err as Error).message
        });
    }
}