import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import db from '../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') return res.status(405).end();
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json([]);
    const token = auth.split(' ')[1];

    try {
        jwt.verify(token, process.env.JWT_SECRET!);
        const result = await db.query(`
            SELECT g.*, u.username as leader_name
            FROM groups g
            LEFT JOIN users u ON g.leader_id = u.id
        `, []);
        res.json(result.rows);
    } catch {
        res.status(401).json([]);
    }
}