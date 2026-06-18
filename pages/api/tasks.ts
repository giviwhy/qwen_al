import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import db from '../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // Token鉴权
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, msg: '未登录', data: [] });
    }
    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        return res.status(500).json({ success: false, msg: '密钥未配置', data: [] });
    }

    let loginUserId: string;
    let loginRole: string;
    try {
        const payload = jwt.verify(token, secret) as { id: string; role: string };
        loginUserId = payload.id;
        loginRole = payload.role;
    } catch (err) {
        console.error('Token错误', err);
        return res.status(401).json({ success: false, msg: '登录失效', data: [] });
    }

    const { groupId } = req.query;
    const gid = Array.isArray(groupId) ? groupId[0] : groupId;
    if (!gid) {
        return res.status(400).json({ success: false, msg: '缺少groupId', data: [] });
    }

    // ====================== 统一权限校验：是否admin 或 本组组长 ======================
    let isAdmin = loginRole === 'admin';
    let isGroupLeader = false;
    try {
        const groupRow = await db.query(`SELECT leader_id FROM groups WHERE id = $1`, [gid]);
        if (groupRow.rows.length === 0) {
            return res.status(404).json({ success: false, msg: '小组不存在', data: [] });
        }
        isGroupLeader = groupRow.rows[0].leader_id === loginUserId;
    } catch (e) {
        console.error('校验小组权限失败', e);
        return res.status(500).json({ success: false, msg: '权限校验异常', data: [] });
    }

    // 既不是超级管理员，也不是本组组长，直接拦截
    if (!isAdmin && !isGroupLeader) {
        return res.status(403).json({ success: false, msg: '无权限操作该小组任务', data: [] });
    }

    // GET 查询本组任务
    if (req.method === 'GET') {
        try {
            const result = await db.query(`
                SELECT t.*, u.username as assignee_name, c.username as creator_name
                FROM tasks t
                LEFT JOIN users u ON t.assigned_to = u.id
                LEFT JOIN users c ON t.created_id = c.id
                WHERE t.group_id = $1
                ORDER BY t.created_at DESC
            `, [gid]);
            return res.status(200).json({ success: true, msg: '查询成功', data: result.rows });
        } catch (e) {
            console.error('查询任务失败', e);
            return res.status(500).json({ success: false, msg: '读取任务失败', data: [] });
        }
    }

    // POST 创建任务
    if (req.method === 'POST') {
        const { title, description, assignedTo, dueDate, priority } = req.body;
        const taskTitle = String(title || '').trim();
        if (!taskTitle) {
            return res.status(400).json({ success: false, msg: '标题必填' });
        }

        // 校验：分配人必须属于该小组组员
        if (assignedTo) {
            const memberCheck = await db.query(
                `SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2`,
                [gid, assignedTo]
            );
            if (memberCheck.rows.length === 0) {
                return res.status(400).json({ success: false, msg: '仅可分配本组内成员' });
            }
        }

        try {
            const insertRes = await db.query(`
                INSERT INTO tasks (group_id, title, description, assigned_to, creator_id, due_date, priority, status)
                VALUES ($1, $2, $3, $4, $5, $6, $7, 'todo')
                RETURNING *
            `, [
                gid,
                taskTitle,
                description || null,
                assignedTo || null,
                loginUserId,
                dueDate || null,
                priority || 'medium'
            ]);
            return res.status(201).json({ success: true, msg: '创建成功', data: insertRes.rows[0] });
        } catch (e) {
            console.error('创建任务失败', e);
            return res.status(500).json({ success: false, msg: '创建任务失败' });
        }
    }

    // 不支持的请求方式
    return res.status(405).json({ success: false, msg: '不支持该请求方式' });
}