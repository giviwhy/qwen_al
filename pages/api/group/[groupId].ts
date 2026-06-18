import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import db from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { groupId } = req.query;
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).end();
    const token = auth.split(' ')[1];

    let payload: { id: string; role: string };
    try {
        payload = jwt.verify(token, process.env.JWT_SECRET!) as { id: string; role: string };
    } catch {
        return res.status(401).end();
    }
    if (payload.role !== 'admin') return res.status(403).end();

    // PUT 编辑小组
    if (req.method === 'PUT') {
        const { name, description } = req.body;
        const result = await db.query(`
      UPDATE groups SET name=$1, description=$2 WHERE id=$3 RETURNING *
    `, [name, description, groupId]);
        return res.json(result.rows[0]);
    }

    // DELETE 删除小组（级联删除任务、通知）
    if (req.method === 'DELETE') {
        await db.query('DELETE FROM tasks WHERE group_id = $1', [groupId]);
        await db.query('DELETE FROM notifications WHERE group_id = $1', [groupId]);
        await db.query('DELETE FROM groups WHERE id = $1', [groupId]);
        return res.json({ success: true });
    }

    return res.status(405).end();
}