import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import db from '../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // 仅允许GET请求
    if (req.method !== 'GET') {
        return res.status(405).json({
            success: false,
            msg: '仅支持GET请求获取小组列表',
            data: []
        });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            msg: '未登录或Token格式错误，请重新登录',
            data: []
        });
    }
    const token = authHeader.split(' ')[1];

    let payload: { id: string; role: string };
    try {
        const secret = process.env.JWT_SECRET;
        if (!secret) throw new Error('JWT密钥未配置');
        payload = jwt.verify(token, secret) as { id: string; role: string };
    } catch (err) {
        console.error('Token解析失败：', err);
        return res.status(401).json({
            success: false,
            msg: '登录已失效，请重新登录',
            data: []
        });
    }

    try {
        let sql: string;
        let params: string[];
        // 管理员：查询全部小组，无过滤
        if (payload.role === 'admin') {
            sql = `
                SELECT DISTINCT g.*, u.username AS leader_name
                FROM groups g
                LEFT JOIN users u ON g.leader_id = u.id
                ORDER BY g.created_at DESC
            `;
            params = [];
        } else {
            // 普通用户：只查自己加入的小组
            sql = `
                SELECT DISTINCT g.*, u.username AS leader_name
                FROM groups g
                LEFT JOIN users u ON g.leader_id = u.id
                INNER JOIN group_members gm ON g.id = gm.group_id
                WHERE gm.user_id = $1
                ORDER BY g.created_at DESC
            `;
            params = [payload.id];
        }
        const result = await db.query(sql, params);

        return res.status(200).json({
            success: true,
            msg: '查询成功',
            data: result.rows || []
        });
    } catch (dbErr) {
        console.error('查询小组数据库异常：', dbErr);
        return res.status(500).json({
            success: false,
            msg: '服务器查询小组数据失败',
            data: []
        });
    }
}