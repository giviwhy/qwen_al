import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import db from '../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // 顶层过滤请求方式，非GET/POST直接拦截
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ success: false, msg: '仅支持GET/POST请求', data: [] });
    }

    // 1. Token登录鉴权
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
        console.error('Token校验失败', err);
        return res.status(401).json({ success: false, msg: '登录失效', data: [] });
    }

    // 2. 解析并强校验小组ID
    const { groupId } = req.query;
    const gid = Array.isArray(groupId) ? groupId[0] : groupId;
    if (!gid || typeof gid !== 'string') {
        return res.status(400).json({ success: false, msg: '小组ID无效', data: [] });
    }

    // 3. 独立try：校验小组权限（管理员/本组组长）
    let isAdmin = loginRole === 'admin';
    let isGroupLeader = false;
    try {
        const groupRow = await db.query(`SELECT leader_id FROM groups WHERE id = $1`, [gid]);
        if (groupRow.rows.length === 0) {
            return res.status(404).json({ success: false, msg: '小组不存在', data: [] });
        }
        isGroupLeader = groupRow.rows[0].leader_id === loginUserId;
    } catch (e) {
        console.error('小组权限查询异常', e);
        return res.status(500).json({ success: false, msg: '权限校验异常', data: [] });
    }

    // 权限拦截：非管理员且非本组组长禁止操作
    if (!isAdmin && !isGroupLeader) {
        return res.status(403).json({ success: false, msg: '无权限操作该小组任务', data: [] });
    }

    // ====================== GET：查询本组所有任务 ======================
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
            console.error('查询任务SQL异常', e);
            return res.status(500).json({ success: false, msg: '读取任务失败', data: [] });
        }
    }

    // ====================== POST：新建本组任务 ======================
    if (req.method === 'POST') {
        const { title, description, assignedTo, dueDate, priority } = req.body;
        const taskTitle = String(title || '').trim();
        if (!taskTitle) {
            return res.status(400).json({ success: false, msg: '任务标题不能为空', data: [] });
        }

        // 校验分配人必须属于当前小组
        if (assignedTo) {
            try {
                const memberCheck = await db.query(
                    `SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2`,
                    [gid, assignedTo]
                );
                if (memberCheck.rows.length === 0) {
                    return res.status(400).json({ success: false, msg: '仅可分配本组内成员', data: [] });
                }
            } catch (e) {
                console.error('组员校验SQL异常', e);
                return res.status(500).json({ success: false, msg: '分配成员校验失败', data: [] });
            }
        }

        // 插入新任务
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
            console.error('新建任务SQL异常', e);
            return res.status(500).json({ success: false, msg: '创建任务失败', data: [] });
        }
    }
}