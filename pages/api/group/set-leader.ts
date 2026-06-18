import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import db from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'PUT') return res.status(405).end();
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).end();
    const token = auth.split(' ')[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { id: string; role: string };
    if (payload.role !== 'admin') return res.status(403).json({ msg: '仅管理员可修改组长' });

    const { groupId, newLeaderId } = req.body;
    await db.query('UPDATE groups SET leader_id = $1 WHERE id = $2', [newLeaderId, groupId]);
    res.json({ success: true });
}