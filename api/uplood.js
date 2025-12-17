const cloudinary = require('cloudinary').v2;
const { Client } = require('pg');
const bodyParser = require('busboy-body-parser');

// 数据库操作辅助函数
async function saveToDatabase(url, name) {
    const client = new Client({
        connectionString: process.env.NETLIFY_DATABASE_URL,
        ssl: { rejectUnauthorized: false } // 必须开启 SSL 才能连接云数据库
    });
    try {
        await client.connect();
        // 确保表存在（如果不存在则创建）
        await client.query(`
            CREATE TABLE IF NOT EXISTS photos (
                id SERIAL PRIMARY KEY,
                photo_url TEXT NOT NULL,
                uploader_name VARCHAR(255),
                timestamp BIGINT
            );
        `);
        // 插入数据
        const query = 'INSERT INTO photos(photo_url, uploader_name, timestamp) VALUES($1, $2, $3)';
        const values = [url, name, Date.now()];
        await client.query(query, values);
    } finally {
        await client.end();
    }
}

exports.handler = async (event) => {
    // 允许跨域
    const headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type"
    };

    if (event.httpMethod === "OPTIONS") {
        return { statusCode: 200, headers, body: "" };
    }

    // 1. 配置 Cloudinary
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    });

    try {
        // 2. 解析上传的文件和字段
        // 注意：Netlify 的 event.body 有可能是 base64 编码的
        const isBase64 = event.isBase64Encoded;
        const bodyBuffer = isBase64 ? Buffer.from(event.body, 'base64') : Buffer.from(event.body);
        
        // 构造一个 fake request 对象供 busboy-body-parser 使用
        const fakeReq = {
            headers: event.headers,
            body: bodyBuffer
        };

        await new Promise((resolve) => bodyParser(fakeReq, resolve));

        const file = fakeReq.files ? fakeReq.files[0] : null;
        // 获取前端传递的注册名（对应 HTML 里的 formData.append('uploader-name', currentUserName)）
        const uploaderName = fakeReq.body['uploader-name'] || '匿名圣诞老人';

        if (!file) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ msg: "未检测到文件，请重试！" })
            };
        }

        // 3. 上传到 Cloudinary
        const uploadResult = await cloudinary.uploader.upload(
            `data:${file.mimetype};base64,${file.data.toString('base64')}`,
            {
                folder: 'christmas-photowall',
                public_id: `photo_${Date.now()}`
            }
        );

        // 4. 保存到数据库
        await saveToDatabase(uploadResult.secure_url, uploaderName);

        // 5. 返回成功响应
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                url: uploadResult.secure_url,
                name: uploaderName,
                msg: "上传成功，照片已入库！"
            })
        };

    } catch (error) {
        console.error("Upload Error:", error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ msg: "服务器错误", error: error.message })
        };
    }
};