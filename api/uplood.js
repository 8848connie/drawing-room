// api/upload.js (修正和优化版本)
const cloudinary = require('cloudinary').v2;
const formidable = require('formidable');
const { Writable } = require('stream'); // 引入 Node.js 流模块

// 配置 Cloudinary，密钥将从 Netlify 环境变量中自动加载
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// 核心修正：创建 Formidable 可接受的事件对象解析器
// Netlify Functions 的事件对象不是标准的 Node.js Request 对象，需要适配。
const fileParse = (event) => new Promise((resolve, reject) => {
    // 创建一个模拟的请求对象，用于 formidable.parse
    const req = {
        headers: event.headers,
        method: event.httpMethod,
        // formidable 需要一个可写流，但 Netlify 只有 body 字符串
        // 我们创建一个空的 Writable 流来欺骗 formidable (这是社区常用的技巧)
        pipe: () => {} 
    };

    const form = formidable({
        multiples: false,
        maxFileSize: 5 * 1024 * 1024,
    });
    
    // 关键修正：将 Netlify 的 event 对象传入 form.parse
    // 在 Netlify 环境中，formidable 被设计为可以接受 event 对象作为第一个参数
    form.parse(event, (err, fields, files) => {
        if (err) {
            console.error("Formidable解析错误:", err);
            return reject(new Error("文件解析失败，可能是请求体格式错误。"));
        }
        
        // 'photo' 是 input 标签的 name 属性
        // 注意：fields 和 files 返回的是数组，需要取第一个元素
        const file = files.photo && files.photo[0]; 
        
        // 额外的上传者名字字段（如果您在前端添加了）
        const uploaderName = fields['uploader-name'] ? fields['uploader-name'][0] : '匿名朋友';
        
        if (!file) {
            return reject(new Error("未找到上传文件，请确保文件已选择。"));
        }
        
        resolve({ file, uploaderName });
    });
});


// Netlify Function 的入口函数
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    // 1. 解析请求体，获取文件和名字
    const { file: uploadedFile, uploaderName } = await fileParse(event);

    // 2. 将文件从临时路径上传到 Cloudinary
    // uploadedFile.filepath 包含 formidable 存储的临时文件路径
    const uploadResult = await cloudinary.uploader.upload(uploadedFile.filepath, {
      folder: 'christmas-photowall',
      public_id: `${Date.now()}_${uploaderName.replace(/\s+/g, '_')}`, // 使用名字生成唯一的 public_id
      tags: ['photowall', 'christmas', uploaderName]
    });

    // 3. 返回上传成功的信息和 Cloudinary URL
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      // 携带上传者的名字返回，供前端使用
      body: JSON.stringify({ 
          url: uploadResult.secure_url, 
          msg: 'Upload successful',
          name: uploaderName
      }),
    };

  } catch (error) {
    console.error('上传功能失败:', error);
    // 增加一个更清晰的 400 状态码来处理客户端错误
    const statusCode = error.message.includes("未找到上传文件") ? 400 : 500;
    
    return {
      statusCode: statusCode,
      headers: { 'Content-Type': 'application/json' },
      // 返回一个清晰的错误消息，而不是默认的 HTML 错误页面
      body: JSON.stringify({ msg: '上传处理失败', error: error.message }),
    };
  }
};