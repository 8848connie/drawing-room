// api/upload.js (使用 busboy-body-parser 适配器的最终修正版本)

const cloudinary = require('cloudinary').v2;
const { Client } = require('pg');
// 引入新的文件流解析器
const bodyParser = require('busboy-body-parser'); 

// 辅助函数：连接数据库（防止连接泄露）
async function runQuery(query, values) {
    const client = new Client({
        connectionString: process.env.NETLIFY_DATABASE_URL, 
    });
    try {
        await client.connect();
        const result = await client.query(query, values);
        return result;
    } finally {
        if (client) {
            await client.end();
        }
    }
}


exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    // 严谨性：在处理之前配置 Cloudinary，使用环境变量
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    });

    try {
        // 1. 使用 busboy-body-parser 解析 event
        // 解析后的文件和字段会挂载到 event.body
        await new Promise((resolve, reject) => {
            // Netlify Functions 需要将 isBase64Encoded 设为 true 来确保正确解析
            event.isBase64Encoded = true; 
            
            // 使用 bodyParser 解析 event
            bodyParser(event, (err) => {
                if (err) return reject(err);
                resolve();
            });
        });

        const file = event.files && event.files[0];
        const uploaderName = event.body['uploader-name'] || '匿名朋友';
        
        if (!file) {
             // 如果文件解析失败，返回 400 状态码
             return {
                 statusCode: 400,
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ msg: '上传文件解析失败，请重试。' })
             };
        }

        // 2. 将文件上传到 Cloudinary
        // file.content 是 busboy 解析出的文件内容 (Buffer)
        const uploadResult = await cloudinary.uploader.upload(
            `data:${file.contentType};base64,${file.content.toString('base64')}`, // 将 Buffer 转换为 Base64 URI
            {
                folder: 'christmas-photowall',
                public_id: `${Date.now()}_${uploaderName.replace(/\s+/g, '_')}`,
                tags: ['photowall', 'christmas', uploaderName]
            }
        );

        // 3. 写入数据库
        const insertQuery = `
            INSERT INTO photos(photo_url, uploader_name, timestamp) 
            VALUES($1, $2, $3);
        `;
        const values = [uploadResult.secure_url, uploaderName, Date.now()];
        
        // 使用辅助函数执行查询，隔离数据库连接代码
        await runQuery(insertQuery, values);


        // 4. 返回成功信息
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: uploadResult.secure_url, msg: 'Upload successful', name: uploaderName }),
        };

    } catch (error) {
        console.error('上传功能失败:', error);
        
        // 确保在任何崩溃时都返回有效的 JSON 错误
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ msg: '服务器处理失败', error: error.message }),
        };
    }
};