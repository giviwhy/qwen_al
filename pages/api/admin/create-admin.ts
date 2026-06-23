import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../lib/db';
import bcrypt from 'bcryptjs';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, msg: '仅支持POST' });
    }

    try {
        // 创建默认管理员账号（如果不存在）
        const adminEmail = 'admin@example.com';
        const adminPassword = 'admin123';
        const adminUsername = 'admin';

        // 检查管理员是否已存在
        const existCheck = await db.query(
            'SELECT id FROM users WHERE username = $1',
            [adminUsername]
        );

        if (existCheck.rows.length === 0) {
            // 创建管理员（开发环境使用6轮盐以提升性能）
            const hashPwd = await bcrypt.hash(adminPassword, 6);
            await db.query(
                `INSERT INTO users (username, email, password, role) VALUES ($1, $2, $3, $4)`,
                [adminUsername, adminEmail, hashPwd, 'admin']
            );
            return res.status(201).json({
                success: true,
                msg: '管理员账号创建成功',
                admin: {
                    username: adminUsername,
                    password: adminPassword
                }
            });
        } else {
            // 更新现有用户为管理员
            await db.query(
                'UPDATE users SET role = $1 WHERE username = $2',
                ['admin', adminUsername]
            );
            return res.status(200).json({
                success: true,
                msg: '已将 ' + adminUsername + ' 设置为管理员'
            });
        }
    } catch (err) {
        console.error('创建管理员失败：', err);
        return res.status(500).json({
            success: false,
            msg: '创建管理员失败: ' + (err as Error).message
        });
    }
}
