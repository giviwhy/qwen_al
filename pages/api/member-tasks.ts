import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import db from '../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, msg: '仅支持GET', data: [] });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, msg: '未登录', data: [] });
    }
    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ success: false, msg: '密钥未配置', data: [] });

    let loginUserId: string;
    try {
        const payload = jwt.verify(token, secret) as { id: string; role: string };
        loginUserId = payload.id;
    } catch {
        return res.status(401).json({ success: false, msg: '登录失效', data: [] });
    }

    const { groupId } = req.query;
    const gid = Array.isArray(groupId) ? groupId[0] : groupId;
    if (!gid) return res.status(400).json({ success: false, msg: '缺少小组ID', data: [] });

    // 校验当前用户是该小组成员或组长
    const memberRow = await db.query(
        `SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2`,
        [gid, loginUserId]
    );
    
    // 检查是否是组长
    const leaderRow = await db.query(
        `SELECT 1 FROM groups WHERE id = $1 AND leader_id = $2`,
        [gid, loginUserId]
    );
    
    // 用户既不是成员也不是组长，禁止访问
    if (memberRow.rows.length === 0 && leaderRow.rows.length === 0) {
        return res.status(403).json({ success: false, msg: '你不属于该小组，禁止访问', data: [] });
    }

    const result = await db.query(`
    SELECT t.*, u.username as assignee_name, c.username as creator_name
    FROM tasks t
    LEFT JOIN users u ON t.assignee_id = u.id
    LEFT JOIN users c ON t.creator_id = c.id
    WHERE t.group_id = $1
    ORDER BY t.created_at DESC
  `, [gid]);

    return res.status(200).json({ success: true, data: result.rows });
}