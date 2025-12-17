const { Client } = require('pg');

exports.handler = async (event) => {
    // 基础头信息，允许跨域
    const headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type"
    };

    // 严谨性检查：只允许 GET 请求
    if (event.httpMethod === "OPTIONS") {
        return { statusCode: 200, headers, body: "" };
    }

    const client = new Client({
        connectionString: process.env.NETLIFY_DATABASE_URL,
        ssl: { rejectUnauthorized: false } // 连接云数据库必须开启 SSL
    });

    try {
        await client.connect();
        
        // 1. 自动创建表（以防万一你还没建表）
        await client.query(`
            CREATE TABLE IF NOT EXISTS photos (
                id SERIAL PRIMARY KEY,
                photo_url TEXT NOT NULL,
                uploader_name VARCHAR(255),
                timestamp BIGINT
            );
        `);

        // 2. 从数据库读取所有照片，按时间倒序排列（最新的在前面）
        const result = await client.query('SELECT photo_url, uploader_name, timestamp FROM photos ORDER BY timestamp DESC');

        // 3. 格式化数据，适配你的 HTML 设计
        const photoList = result.rows.map(row => ({
            url: row.photo_url, 
            name: row.uploader_name,
            timestamp: row.timestamp
        }));

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(photoList),
        };

    } catch (error) {
        console.error('获取照片列表失败:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ msg: '无法加载照片历史记录', error: error.message }),
        };
    } finally {
        await client.end();
    }
};