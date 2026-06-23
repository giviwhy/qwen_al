import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../lib/db';
import bcrypt from 'bcryptjs';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, msg: '仅支持GET' });
    }

    try {
        // 检查是否已存在 admin 用户
        const existingUser = await db.query('SELECT * FROM users WHERE username = $1', ['admin']);

        if (existingUser.rows.length > 0) {
            return res.status(200).json({
                success: true,
                msg: '管理员账号已存在',
                admin: {
                    username: 'admin',
                    password: 'admin123'
                }
            });
        }

        // 使用 bcrypt 加密密码（开发环境使用6轮盐以提升性能）
        const adminPassword = 'admin123';
        const hashedPassword = await bcrypt.hash(adminPassword, 6);

        // 创建管理员账号
        await db.query(
            'INSERT INTO users (username, password, email, role) VALUES ($1, $2, $3, $4)',
            ['admin', hashedPassword, 'admin@team-board.com', 'admin']
        );

        return res.status(200).json({
            success: true,
            msg: '管理员账号创建成功',
            admin: {
                username: 'admin',
                password: adminPassword
            }
        });
    } catch (err) {
        console.error('创建管理员失败：', err);
        return res.status(500).json({
            success: false,
            msg: '创建管理员失败: ' + (err as Error).message
        });
    }
}