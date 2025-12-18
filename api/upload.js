const cloudinary = require('cloudinary').v2;
const { Client } = require('pg');
const Busboy = require('busboy');

// 数据库存储逻辑
async function saveToDatabase(url, name) {
    const client = new Client({
        connectionString: process.env.NETLIFY_DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    try {
        await client.connect();
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

    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    });

    try {
        return await new Promise((resolve, reject) => {
            const busboy = Busboy({ headers: event.headers });
            let uploaderName = '匿名圣诞老人';
            let uploadStarted = false;

            busboy.on('field', (fieldname, val) => {
                if (fieldname === 'uploader-name') uploaderName = val;
            });

            busboy.on('file', (fieldname, file) => {
                uploadStarted = true;
                // 🟢 核心改进：直接 pipe (对接) 流，不存入内存 Buffer
                const stream = cloudinary.uploader.upload_stream(
                    { folder: 'christmas-photowall' },
                    async (error, result) => {
                        if (error) {
                            return resolve({ statusCode: 500, headers, body: JSON.stringify({ msg: "云端上传失败", error: error.message }) });
                        }
                        // 上传成功后存数据库
                        try {
                            await saveToDatabase(result.secure_url, uploaderName);
                            resolve({
                                statusCode: 200,
                                headers,
                                body: JSON.stringify({ url: result.secure_url, name: uploaderName, msg: "OK" })
                            });
                        } catch (dbErr) {
                            resolve({ statusCode: 500, headers, body: JSON.stringify({ msg: "数据库写入失败" }) });
                        }
                    }
                );
                file.pipe(stream); // 👈 这一行是解决 502 的关键！
            });

            busboy.on('error', (err) => resolve({ statusCode: 500, headers, body: JSON.stringify({ msg: "解析失败" }) }));

            // 处理 Netlify Body
            const body = event.isBase64Encoded ? Buffer.from(event.body, 'base64') : Buffer.from(event.body);
            busboy.end(body);
        });
    } catch (error) {
        return { statusCode: 500, headers, body: JSON.stringify({ msg: "系统崩溃", error: error.message }) };
    }
};
