import jwt from 'jsonwebtoken';
import db from '../../lib/db';

export default async function handler(req, res) {
    // 限制请求方法
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, msg: '仅支持GET请求', data: [] });
    }

    const authHeader = req.headers.authorization;
    // 校验标准Bearer Token格式
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, msg: '未登录或Token格式错误', data: [] });
    }
    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        return res.status(500).json({ success: false, msg: '服务密钥未配置', data: [] });
    }

    let payload;
    try {
        payload = jwt.verify(token, secret);
    } catch (err) {
        console.error('管理员接口Token校验失败：', err);
        return res.status(401).json({ success: false, msg: '登录已失效，请重新登录', data: [] });
    }

    // 管理员权限校验
    if (payload.role !== 'admin') {
        return res.status(403).json({ success: false, msg: '无管理员权限', data: [] });
    }

    try {
        // 查询全部用户基础信息
        const result = await db.query('SELECT id, username, role FROM users', []);
        return res.status(200).json({
            success: true,
            msg: '用户列表查询成功',
            data: result.rows
        });
    } catch (dbErr) {
        console.error('查询用户列表数据库异常：', dbErr);
        return res.status(500).json({ success: false, msg: '服务器读取用户列表失败', data: [] });
    }
}