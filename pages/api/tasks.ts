import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import db from '../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).end();
    const token = auth.split(' ')[1];

    // 提升payload到外层作用域，全局可用
    let payload: { id: string };
    try {
        payload = jwt.verify(token, process.env.JWT_SECRET!) as { id: string };
    } catch {
        return res.status(401).json({ msg: '登录失效，请重新登录' });
    }
    const userId = payload.id;

    // GET 查询任务
    if (req.method === 'GET') {
        const { groupId } = req.query;
        if (!groupId) return res.status(400).json([]);
        const result = await db.query(`
            SELECT t.*, creator.username creator_name, assignee.username assignee_name
            FROM tasks t
            LEFT JOIN users creator ON t.creator_id = creator.id
            LEFT JOIN users assignee ON t.assigned_to = assignee.id
            WHERE t.group_id = $1
            ORDER BY t.created_at DESC
        `, [groupId]);
        return res.json(result.rows);
    }

    // POST 创建任务
    if (req.method === 'POST') {
        const { title, description, groupId, assignedTo, dueDate, priority } = req.body;

        // 组长权限校验（移到POST内部，先取groupId再查询）
        const groupCheck = await db.query('SELECT leader_id FROM groups WHERE id = $1', [groupId]);
        if (!groupCheck.rows.length) return res.status(400).json({ msg: '小组不存在' });
        const groupLeaderId = groupCheck.rows[0].leader_id;
        // 判断当前登录用户是否为本组组长
        if (payload.id !== groupLeaderId) {
            return res.status(403).json({ msg: '只有小组组长可以发布任务' });
        }

        const insert = await db.query(`
            INSERT INTO tasks (title, description, group_id, creator_id, assigned_to, due_date, priority, status)
            VALUES ($1,$2,$3,$4,$5,$6,$7,'todo')
            RETURNING *
        `, [title, description, groupId, userId, assignedTo || null, dueDate || null, priority]);

        const newTask = insert.rows[0];
        // 回填创建人名称
        newTask.creator_name = (await db.query('SELECT username FROM users WHERE id = $1', [userId])).rows[0].username;
        // 回填负责人名称
        if (assignedTo) {
            newTask.assignee_name = (await db.query('SELECT username FROM users WHERE id = $1', [assignedTo])).rows[0]?.username;
        }
        return res.json(newTask);
    }

    // 不支持的请求方式
    return res.status(405).json({ msg: '请求方式不允许' });
}