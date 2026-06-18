import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../lib/db';
import bcrypt from 'bcryptjs';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') return res.status(405).end();
    const { username, email, password } = req.body;

    const hash = await bcrypt.hash(password, 10);

    try {
        await db.query(
            'INSERT INTO users (username, email, password) VALUES ($1,$2,$3)',
            [username, email, hash]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ success: false, msg: '用户名或邮箱已被注册' });
    }
}