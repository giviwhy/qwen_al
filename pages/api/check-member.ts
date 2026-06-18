import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import db from '../../lib/db';

// 所有业务代码必须包裹在这个handler函数内部
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, msg: '仅支持GET请求' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, msg: '未登录，请先登录' });
    }
    const token = authHeader.split(' ')[1];
    try {
        jwt.verify(token, process.env.JWT_SECRET!);
    } catch {
        return res.status(401).json({ success: false, msg: '登录已失效，请重新登录' });
    }

    // 取参数的代码移到函数内部
    const { groupId, userId } = req.query;
    const gid = Array.isArray(groupId) ? groupId[0] : groupId;
    const uid = Array.isArray(userId) ? userId[0] : userId;

    if (!gid || !uid) {
        return res.status(400).json({ success: false, msg: 'groupId、userId不能为空' });
    }

    try {
        const result = await db.query(
            'SELECT id FROM group_members WHERE group_id = $1 AND user_id = $2',
            [gid, uid]
        );
        return res.status(200).json({
            success: true,
            isMember: result.rows.length > 0
        });
    } catch (dbErr) {
        console.error('数据库查询异常：', dbErr);
        return res.status(500).json({ success: false, msg: '数据库查询失败' });
    }
}