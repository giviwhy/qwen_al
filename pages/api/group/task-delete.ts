import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import db from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        if (req.method !== 'POST') {
            return res.status(405).json({ success: false, msg: '仅支持POST', data: [] });
        }

        // 登录鉴权
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, msg: '未登录', data: [] });
        }
        const token = authHeader.split(' ')[1];
        const secret = process.env.JWT_SECRET;
        if (!secret) return res.status(500).json({ success: false, msg: '密钥未配置', data: [] });

        let loginUserId: string;
        let loginRole: string;
        try {
            const payload = jwt.verify(token, secret) as { id: string; role: string };
            loginUserId = payload.id;
            loginRole = payload.role;
        } catch (err) {
            console.error('token错误', err);
            return res.status(401).json({ success: false, msg: '登录失效', data: [] });
        }

        const { taskId } = req.body;
        if (!taskId) {
            return res.status(400).json({ success: false, msg: '缺少taskId', data: [] });
        }

        // 通过任务反查所属小组与组长ID
        const taskGroupRes = await db.query(`
      SELECT g.id group_id, g.leader_id
      FROM tasks t
      LEFT JOIN groups g ON t.group_id = g.id
      WHERE t.id = $1
    `, [taskId]);

        if (taskGroupRes.rows.length === 0) {
            return res.status(404).json({ success: false, msg: '任务不存在', data: [] });
        }
        const { leader_id } = taskGroupRes.rows[0];
        const isAdmin = loginRole === 'admin';
        const isLeader = leader_id === loginUserId;

        if (!isAdmin && !isLeader) {
            return res.status(403).json({ success: false, msg: '无权限删除该任务', data: [] });
        }

        // 删除任务
        await db.query(`DELETE FROM tasks WHERE id = $1`, [taskId]);
        return res.status(200).json({ success: true, msg: '删除成功', data: [] });
    } catch (e) {
        console.error('删除任务全局异常', e);
        return res.status(500).json({ success: false, msg: '服务器错误', data: [] });
    }
}