import jwt from 'jsonwebtoken';
import db from '../../lib/db';

export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ success: false, msg: "仅GET" });
    const { groupId } = req.query;
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return res.status(401).json({ success: false, data: [] });
    const token = auth.split(' ')[1];
    let payload;
    try {
        payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
        return res.status(401).json({ success: false, data: [] });
    }
    if (payload.role !== 'admin') return res.status(403).json({ success: false, data: [] });

    // 查询所有不在当前小组内的普通用户
    const sql = `
        SELECT id, username
        FROM users
        WHERE id NOT IN (
            SELECT user_id FROM group_members WHERE group_id = $1
        )
        AND role != 'admin'
    `;
    const result = await db.query(sql, [groupId]);
    return res.json({ success: true, data: result.rows });
}