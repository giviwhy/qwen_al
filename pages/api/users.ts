import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import db from '../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') return res.status(405).end();
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).end();
    const token = auth.split(' ')[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { role: string };
    if (payload.role !== 'admin') return res.status(403).end();

    const result = await db.query('SELECT id,username,role FROM users', []);
    res.json(result.rows);
}