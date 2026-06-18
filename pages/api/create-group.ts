import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import db from '../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // 限制请求方法
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, msg: '仅支持POST请求' });
    }

    // 校验登录Token
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, msg: '未登录，请先登录' });
    }
    const token = auth.split(' ')[1];

    let payload: { id: string; role: string };
    try {
        payload = jwt.verify(token, process.env.JWT_SECRET!) as { id: string; role: string };
    } catch {
        return res.status(401).json({ success: false, msg: '登录失效，请重新登录' });
    }

    // 管理员权限校验
    if (payload.role !== 'admin') {
        return res.status(403).json({ success: false, msg: '仅管理员可创建小组' });
    }

    // 读取并校验入参
    const { name, description } = req.body;
    if (!name || String(name).trim() === '') {
        return res.status(400).json({ success: false, msg: '小组名称不能为空' });
    }

    try {
        // 插入小组，管理员自动设为组长
        const insertRes = await db.query(`
            INSERT INTO groups (name, description, admin_id, leader_id)
            VALUES ($1, $2, $3, $3)
            RETURNING *
        `, [name.trim(), description || null, payload.id]);

        // 插入失败兜底
        if (insertRes.rows.length === 0) {
            return res.status(500).json({ success: false, msg: '小组创建失败' });
        }
        const groupData = insertRes.rows[0];

        // 查询管理员用户名，用于前端展示组长名称
        const leaderInfo = await db.query('SELECT username FROM users WHERE id = $1', [payload.id]);
        if (leaderInfo.rows.length > 0) {
            groupData.leader_name = leaderInfo.rows[0].username;
        }

        // 标准成功返回
        return res.status(200).json({
            success: true,
            msg: '小组创建成功',
            data: groupData
        });
    } catch (dbErr) {
        console.error('创建小组数据库异常：', dbErr);
        return res.status(500).json({ success: false, msg: '数据库操作失败，创建小组失败' });
    }
}