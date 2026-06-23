import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import db from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, msg: '仅支持POST' });
    }

    // 仅管理员放行
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ success: false, msg: '未登录' });
    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET;

    try {
        const payload = jwt.verify(token, secret!) as { id: string; role: string };
        if (payload.role !== 'admin') return res.status(403).json({ success: false, msg: '仅管理员可清空数据' });
    } catch {
        return res.status(401).json({ success: false, msg: '登录失效' });
    }

    try {
        // 清空所有表的数据（保留表结构）
        // 按照外键依赖顺序删除
        await db.query('DELETE FROM notification_read', []);
        await db.query('DELETE FROM notifications', []);
        await db.query('DELETE FROM tasks', []);
        await db.query('DELETE FROM group_members', []);
        await db.query('DELETE FROM groups', []);
        await db.query('DELETE FROM users', []);

        // 自动重新创建管理员账号
        const adminUsername = 'admin';
        const adminPassword = 'admin123';
        const hashedPassword = await bcrypt.hash(adminPassword, 6); // 开发环境使用6轮盐

        await db.query(
            'INSERT INTO users (username, password, email, role) VALUES ($1, $2, $3, $4)',
            [adminUsername, hashedPassword, 'admin@team-board.com', 'admin']
        );

        return res.status(200).json({
            success: true,
            msg: '数据库数据已清空，管理员账号已自动重新创建',
            admin: {
                username: adminUsername,
                password: adminPassword
            }
        });
    } catch (err) {
        console.error('清空数据库失败：', err);
        return res.status(500).json({
            success: false,
            msg: '清空数据库失败: ' + (err as Error).message
        });
    }
}