import jwt from 'jsonwebtoken';
import db from '../../lib/db';

export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ success: false });
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return res.status(401).json({ success: false, data: [] });
    const token = auth.split(' ')[1];
    let payload;
    try {
        payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
        return res.status(401).json({ success: false, data: [] });
    }

    // 查询当前用户是组长的全部小组
    const sql = `
    SELECT g.*, u.username AS leader_name
    FROM groups g
    LEFT JOIN users u ON g.leader_id = u.id
    WHERE g.leader_id = $1
    ORDER BY g.created_at DESC
  `;
    const result = await db.query(sql, [payload.id]);
    return res.json({ success: true, data: result.rows });
}