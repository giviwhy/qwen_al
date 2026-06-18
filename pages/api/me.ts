import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import db from '../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') return res.status(405).end();
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({});
    const token = authHeader.split(' ')[1];

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET!) as { id: string };
        const userRes = await db.query('SELECT id, username, role FROM users WHERE id = $1', [payload.id]);
        const user = userRes.rows[0];
        if (!user) return res.status(401).json({});
        res.json(user);
    } catch (err) {
        return res.status(401).json({});
    }
}