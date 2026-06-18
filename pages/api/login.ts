import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../lib/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // 限制请求方法
    if (req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            msg: '仅支持POST登录请求'
        });
    }

    // 取出并校验账号密码入参
    const { username, password } = req.body;
    if (!username || !password || username.trim() === '' || password.trim() === '') {
        return res.status(400).json({
            success: false,
            msg: '用户名和密码不能为空'
        });
    }

    try {
        // 根据用户名查询用户
        const userRes = await db.query('SELECT * FROM users WHERE username = $1', [username.trim()]);
        const user = userRes.rows[0];

        // 用户不存在
        if (!user) {
            return res.status(401).json({
                success: false,
                msg: '账户不存在'
            });
        }

        // 拦截password为空，避免bcrypt第二个参数undefined报错
        if (!user.password) {
            return res.status(401).json({
                success: false,
                msg: '账户密码异常，请联系管理员重置密码'
            });
        }

        // 密码比对，字段名改为password
        const passOk = await bcrypt.compare(password, user.password);
        if (!passOk) {
            console.warn(`用户${username}密码输入错误`);
            return res.status(401).json({
                success: false,
                msg: '密码错误'
            });
        }

        // 生成7天token
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            process.env.JWT_SECRET!,
            { expiresIn: '7d' }
        );

        return res.status(200).json({
            success: true,
            msg: '登录成功',
            data: {
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    role: user.role
                }
            }
        });

    } catch (dbErr) {
        console.error('登录接口数据库异常：', dbErr);
        return res.status(500).json({
            success: false,
            msg: '服务器登录查询失败，请稍后重试'
        });
    }
}