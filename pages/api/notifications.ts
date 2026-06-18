import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import db from '../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') return res.status(405).end();
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json([]);
    const token = auth.split(' ')[1];

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET!) as { id: string };
        const result = await db.query(`
            SELECT n.*, u.username as sender_name
            FROM notifications n
            LEFT JOIN users u ON n.sender_id = u.id
            WHERE n.recipient_id = $1
            ORDER BY n.created_at DESC
        `, [payload.id]);
        res.json(result.rows);
    } catch {
        res.status(401).json([]);
    }
}