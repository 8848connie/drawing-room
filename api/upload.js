const cloudinary = require('cloudinary').v2;
const { Client } = require('pg');
const bodyParser = require('busboy-body-parser');

async function saveToDatabase(url, name) {
    const client = new Client({
        connectionString: process.env.NETLIFY_DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    try {
        await client.connect();
        await client.query(`
            CREATE TABLE IF NOT EXISTS photos (
                id SERIAL PRIMARY KEY,
                photo_url TEXT NOT NULL,
                uploader_name VARCHAR(255),
                timestamp BIGINT
            );
        `);
        const query = 'INSERT INTO photos(photo_url, uploader_name, timestamp) VALUES($1, $2, $3)';
        await client.query(query, [url, name, Date.now()]);
    } finally {
        await client.end();
    }
}

exports.handler = async (event) => {
    const headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type"
    };

    if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };

    // 1. 配置检查 (如果环境变量缺失，直接报错而不是崩溃)
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.NETLIFY_DATABASE_URL) {
        return { statusCode: 500, headers, body: JSON.stringify({ msg: "系统配置缺失，请检查 Netlify 环境变量" }) };
    }

    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    });

    try {
        // 2. 这里的处理逻辑必须非常小心，防止 NodeJsExit
        const bodyBuffer = event.isBase64Encoded 
            ? Buffer.from(event.body, 'base64') 
            : Buffer.from(event.body);

        const fakeReq = {
            headers: {
                ...event.headers,
                'content-type': event.headers['content-type'] || event.headers['Content-Type']
            },
            body: bodyBuffer
        };

        await new Promise((resolve) => bodyParser(fakeReq, resolve));
        const file = fakeReq.files ? fakeReq.files[0] : null;
        const uploaderName = fakeReq.body['uploader-name'] || '圣诞老人';

        if (!file) return { statusCode: 400, headers, body: JSON.stringify({ msg: "未检测到文件" }) };

        // 3. 上传到 Cloudinary
        const uploadResult = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                { folder: 'christmas-photowall' },
                (error, result) => error ? reject(error) : resolve(result)
            );
            stream.end(file.data); // 直接发送 Buffer，不转 Base64，减少内存占用
        });

        // 4. 保存数据库
        await saveToDatabase(uploadResult.secure_url, uploaderName);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ url: uploadResult.secure_url, name: uploaderName, msg: "OK" })
        };

    } catch (error) {
        console.error("Critical Error:", error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ msg: "处理失败", error: error.message })
        };
    }
};
