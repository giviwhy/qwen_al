const { Pool } = require('pg');

const url = new URL(process.env.DATABASE_URL);
const pool = new Pool({
    user: url.username,
    password: url.password,
    host: url.hostname,
    port: parseInt(url.port) || 5432,
    database: url.pathname.slice(1),
    ssl: false
});

async function migrate() {
    console.log('开始数据库迁移...');
    try {
        await pool.query(`
            ALTER TABLE tasks 
            ADD COLUMN IF NOT EXISTS uploaded_files TEXT,
            ADD COLUMN IF NOT EXISTS review_status VARCHAR(20) DEFAULT 'pending',
            ADD COLUMN IF NOT EXISTS review_comment TEXT,
            ADD COLUMN IF NOT EXISTS reviewer_id VARCHAR(36),
            ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP
        `);
        console.log('数据库迁移成功！已添加文件上传和审核字段');
        process.exit(0);
    } catch (err) {
        console.error('数据库迁移失败:', err);
        process.exit(1);
    }
}

migrate();