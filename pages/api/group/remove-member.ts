import jwt from 'jsonwebtoken';
import db from '../../../lib/db';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ success: false, msg: '仅支持POST' });
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return res.status(401).json({ success: false, msg: '未登录' });
    const token = auth.split(' ')[1];

    let payload;
    try {
        payload = jwt.verify(token, process.env.JWT_SECRET!);
    } catch {
        return res.status(401).json({ success: false, msg: '登录失效' });
    }
    if (payload.role !== 'admin') return res.status(403).json({ success: false, msg: '仅管理员操作' });

    const { groupId, userId } = req.body;
    if (!groupId || !userId) return res.status(400).json({ success: false, msg: '参数缺失' });

    await db.query(`DELETE FROM group_members WHERE group_id=$1 AND user_id=$2`, [groupId, userId]);
    return res.json({ success: true, msg: '组员已移出' });
}