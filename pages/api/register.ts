import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../lib/db';
import bcrypt from 'bcryptjs';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // 仅允许POST请求
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, msg: '仅支持POST提交注册' });
    }

    const { username, email, password } = req.body;

    // 1. 非空参数校验
    if (!username || !email || !password) {
        return res.status(400).json({ success: false, msg: '用户名、邮箱、密码不能为空' });
    }

    try {
        // 2. 提前查询，判断用户名/邮箱是否已存在
        const existCheck = await db.query(
            'SELECT id FROM users WHERE username = $1 OR email = $2',
            [username, email]
        );
        if (existCheck.rows.length > 0) {
            return res.status(400).json({ success: false, msg: '用户名或邮箱已被注册' });
        }

        // 3. 密码加密
        const hashPwd = await bcrypt.hash(password, 10);

        // 4. 插入用户，默认角色 member
        await db.query(
            'INSERT INTO users (username, email, password, role) VALUES ($1,$2,$3,$4)',
            [username, email, hashPwd, 'member']
        );

        return res.json({ success: true, msg: '注册成功，请前往登录' });
    } catch (err) {
        console.error('注册接口异常：', err);
        // 区分唯一键冲突与其他服务器错误
        const errorMsg = (err as Error).message.includes('unique constraint')
            ? '用户名或邮箱已被注册'
            : '服务器内部错误，注册失败';
        return res.status(400).json({ success: false, msg: errorMsg });
    }
}