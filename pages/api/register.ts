import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../lib/db';
import bcrypt from 'bcryptjs';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // 仅允许POST请求
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, msg: '仅支持POST提交注册' });
    }

    const { username, email, password } = req.body;
    // 去除首尾空格，过滤纯空格输入
    const uname = String(username).trim();
    const mail = String(email).trim();
    const pwd = String(password).trim();

    // 1. 非空参数校验
    if (!uname || !mail || !pwd) {
        return res.status(400).json({ success: false, msg: '用户名、邮箱、密码不能为空或全空格' });
    }

    try {
        // 2. 提前查询，判断用户名/邮箱是否已存在
        const existCheck = await db.query(
            'SELECT id FROM users WHERE username = $1 OR email = $2',
            [uname, mail]
        );
        if (existCheck.rows.length > 0) {
            return res.status(400).json({ success: false, msg: '用户名或邮箱已被注册' });
        }

        // 3. 密码加密
        const hashPwd = await bcrypt.hash(pwd, 10);

        // 4. 插入用户，把 password_hash 改成 password
        const insertRes = await db.query(
            `INSERT INTO users (username, email, password, role) 
             VALUES ($1,$2,$3,$4) 
             RETURNING id, username, email, role`,
            [uname, mail, hashPwd, 'member']
        );

        return res.status(201).json({
            success: true,
            msg: '注册成功，请前往登录',
            data: insertRes.rows[0]
        });
    } catch (err) {
        console.error('注册接口数据库异常：', err);
        const errMsg = (err as Error).message;
        // 唯一键冲突返回400，其余数据库故障返回500
        if (errMsg.includes('unique constraint')) {
            return res.status(400).json({ success: false, msg: '用户名或邮箱已被注册' });
        } else {
            return res.status(500).json({ success: false, msg: '服务器内部错误，注册失败' });
        }
    }
}