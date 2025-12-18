const cloudinary = require('cloudinary').v2;
const { Client } = require('pg');
const Busboy = require('busboy');

// 数据库存储逻辑
async function saveToDatabase(url, name) {
    const client = new Client({
        connectionString: process.env.NETLIFY_DATABASE_URL,
        ssl: { rejectUnauthorized: false } // 必须开启 SSL
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
        await client.query('INSERT INTO photos(photo_url, uploader_name, timestamp) VALUES($1, $2, $3)', [url, name, Date.now()]);
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

    // 1. 配置 Cloudinary
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    });

    try {
        // 2. 解析多部分表单数据 (不再依赖复杂的 body-parser)
        const result = await new Promise((resolve, reject) => {
            const busboy = Busboy({ headers: event.headers });
            let fileData = null;
            let uploaderName = '匿名圣诞老人';

            busboy.on('file', (fieldname, file, info) => {
                const chunks = [];
                file.on('data', (data) => chunks.push(data));
                file.on('end', () => { fileData = Buffer.concat(chunks); });
            });

            busboy.on('field', (fieldname, val) => {
                if (fieldname === 'uploader-name') uploaderName = val;
            });

            busboy.on('finish', () => resolve({ fileData, uploaderName }));
            busboy.on('error', (err) => reject(err));

            // 处理 Netlify 可能进行的 Base64 编码
            const body = event.isBase64Encoded ? Buffer.from(event.body, 'base64') : Buffer.from(event.body);
            busboy.end(body);
        });

        if (!result.fileData) {
            return { statusCode: 400, headers, body: JSON.stringify({ msg: "未找到上传的图片文件" }) };
        }

        // 3. 上传到 Cloudinary (流式上传)
        const uploadResult = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                { folder: 'christmas-photowall' },
                (error, res) => error ? reject(error) : resolve(res)
            );
            stream.end(result.fileData);
        });

        // 4. 存入数据库
        await saveToDatabase(uploadResult.secure_url, result.uploaderName);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ url: uploadResult.secure_url, name: result.uploaderName, msg: "OK" })
        };

    } catch (error) {
        console.error("上传逻辑崩溃:", error.message);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ msg: "服务器忙，请稍后再试", error: error.message })
        };
    }
};
