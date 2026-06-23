import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import db from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, msg: '仅支持GET' });
    }

    // 验证管理员权限
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, msg: '未登录' });
    }
    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET;

    try {
        const payload = jwt.verify(token, secret!) as { id: string; role: string };
        if (payload.role !== 'admin') {
            return res.status(403).json({ success: false, msg: '仅管理员可访问' });
        }
    } catch {
        return res.status(401).json({ success: false, msg: '登录失效' });
    }

    try {
        // 一次性查询所有需要的数据
        
        // 1. 查询所有小组及其组长信息
        const groupsRes = await db.query(`
            SELECT 
                g.id,
                g.name,
                g.description,
                g.leader_id,
                u.username as leader_name
            FROM groups g
            LEFT JOIN users u ON g.leader_id = u.id
            ORDER BY g.created_at DESC
        `, []);

        // 2. 查询所有用户
        const usersRes = await db.query(`
            SELECT id, username, email, role
            FROM users
            ORDER BY created_at DESC
        `, []);

        // 3. 查询所有已分配的用户ID（用于过滤可添加的用户）
        const occupiedRes = await db.query(`
            SELECT DISTINCT user_id FROM group_members
        `, []);
        const occupiedUserIds = occupiedRes.rows.map(r => r.user_id);

        // 4. 查询所有小组的成员数量
        const membersCountRes = await db.query(`
            SELECT group_id, COUNT(*) as count
            FROM group_members
            GROUP BY group_id
        `, []);
        const membersCountMap: Record<string, number> = {};
        membersCountRes.rows.forEach(r => {
            membersCountMap[r.group_id] = parseInt(r.count);
        });

        // 组合数据：给每个小组添加成员数量
        const groups = groupsRes.rows.map(g => ({
            ...g,
            member_count: membersCountMap[g.id] || 0
        }));

        return res.status(200).json({
            success: true,
            data: {
                groups,
                users: usersRes.rows,
                occupiedUserIds
            }
        });
    } catch (err) {
        console.error('获取管理员数据失败：', err);
        return res.status(500).json({
            success: false,
            msg: '获取数据失败: ' + (err as Error).message
        });
    }
}