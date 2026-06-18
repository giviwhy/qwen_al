import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import db from '../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).end();
    const token = auth.split(' ')[1];
    let userId: string;
    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET!) as { id: string };
        userId = payload.id;
    } catch {
        return res.status(401).end();
    }

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
        const insert = await db.query(`
            INSERT INTO tasks (title, description, group_id, creator_id, assigned_to, due_date, priority, status)
            VALUES ($1,$2,$3,$4,$5,$6,$7,'todo')
            RETURNING *
        `, [title, description, groupId, userId, assignedTo || null, dueDate || null, priority]);
        const newTask = insert.rows[0];
        // 回填用户名
        newTask.creator_name = (await db.query('SELECT username FROM users WHERE id = $1', [userId])).rows[0].username;
        if (assignedTo) {
            newTask.assignee_name = (await db.query('SELECT username FROM users WHERE id = $1', [assignedTo])).rows[0]?.username;
        }
        return res.json(newTask);
    }

    return res.status(405).end();
}