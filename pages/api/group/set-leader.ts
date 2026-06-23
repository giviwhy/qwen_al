import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import db from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'PUT') {
        return res.status(405).json({ success: false, msg: '仅支持PUT请求' });
    }

    const auth = req.headers.authorization;
    if (!auth) {
        return res.status(401).json({ success: false, msg: '未登录' });
    }
    const token = auth.split(' ')[1];

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET!) as { id: string; role: string };
        if (payload.role !== 'admin') {
            return res.status(403).json({ success: false, msg: '仅管理员可修改组长' });
        }

        const { groupId, newLeaderId } = req.body;
        if (!groupId || !newLeaderId) {
            return res.status(400).json({ success: false, msg: '小组ID和组长ID不能为空' });
        }

        // 1. 更新小组组长
        await db.query(
            'UPDATE groups SET leader_id = $1 WHERE id = $2',
            [newLeaderId, groupId]
        );

        // 2. 自动把组长加入组员表，冲突不报错（确保下拉能看到此人）
        await db.query(`
            INSERT INTO group_members (group_id, user_id)
            VALUES ($1, $2)
            ON CONFLICT (group_id, user_id) DO NOTHING
        `, [groupId, newLeaderId]);

        // 3. 将用户角色更新为 leader（如果还不是 leader）
        await db.query(
            'UPDATE users SET role = $1 WHERE id = $2 AND role != $1',
            ['leader', newLeaderId]
        );

        return res.json({ success: true, msg: '组长更换成功' });
    } catch (err) {
        console.error('修改组长接口错误：', err);
        return res.status(500).json({ success: false, msg: '服务器错误，更换组长失败' });
    }
}