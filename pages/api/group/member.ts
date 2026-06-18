import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import db from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, data: [], msg: '仅支持GET请求' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, data: [], msg: '未登录' });
    }
    const token = authHeader.split(' ')[1];

    let payload: { id: string; role: string };
    try {
        payload = jwt.verify(token, process.env.JWT_SECRET!) as { id: string; role: string };
    } catch (err) {
        console.error('token校验失败', err);
        return res.status(401).json({ success: false, data: [], msg: '登录失效' });
    }

    const { groupId } = req.query;
    const gid = typeof groupId === 'string' ? groupId : '';
    if (!gid) {
        return res.status(400).json({ success: false, data: [], msg: '小组ID无效' });
    }

    try {
        // 1. 校验当前用户是否是全局admin 或 本组组长
        const groupInfo = await db.query(`SELECT leader_id FROM groups WHERE id = $1`, [gid]);
        if (groupInfo.rows.length === 0) {
            return res.status(404).json({ success: false, data: [], msg: '小组不存在' });
        }
        const leaderId = groupInfo.rows[0].leader_id;
        const isAdmin = payload.role === 'admin';
        const isLeader = leaderId === payload.id;

        // 无权限直接拦截
        if (!isAdmin && !isLeader) {
            return res.status(403).json({ success: false, data: [], msg: '无权限查看该小组成员' });
        }

        // 2. 查询组员，并标记组长 is_leader
        const sql = `
            SELECT 
                u.id, 
                u.username,
                CASE WHEN u.id = $2 THEN true ELSE false END as is_leader
            FROM group_members gm
            JOIN users u ON gm.user_id = u.id
            WHERE gm.group_id = $1
        `;
        const result = await db.query(sql, [gid, leaderId]);

        // 统一返回格式 success + data
        return res.json({
            success: true,
            data: result.rows
        });
    } catch (sqlErr) {
        console.error('group-members SQL异常', sqlErr);
        return res.status(500).json({ success: false, data: [], msg: '数据库查询失败' });
    }
}