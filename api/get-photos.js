// api/get-photos.js (修正版本)
const { Client } = require('pg');

exports.handler = async (event) => {
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    // 严谨性：从 Netlify 环境变量获取连接 URL
    const client = new Client({
        connectionString: process.env.NETLIFY_DATABASE_URL, 
    });

    try {
        await client.connect();
        
        // 1. 确保 photos 表已存在。如果不存在，部署后您可能需要手动创建。
        // 创建表（首次运行）：
        /*
        await client.query(`
            CREATE TABLE IF NOT EXISTS photos (
                id SERIAL PRIMARY KEY,
                photo_url TEXT NOT NULL,
                uploader_name VARCHAR(255),
                timestamp BIGINT
            );
        `);
        */
        
        // 2. 读取所有照片记录
        const result = await client.query('SELECT photo_url, uploader_name, timestamp FROM photos ORDER BY timestamp DESC');

        const photoList = result.rows.map(row => ({
            url: row.photo_url, 
            name: row.uploader_name,
            timestamp: row.timestamp
        }));

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(photoList),
        };

    } catch (error) {
        console.error('获取照片列表失败:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ msg: '无法加载照片历史记录', error: error.message }),
        };
    } finally {
        // 严谨性：确保关闭数据库连接
        if (client) {
            await client.end();
        }
    }
};