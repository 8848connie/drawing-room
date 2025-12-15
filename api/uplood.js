// 导入依赖
const cloudinary = require('cloudinary').v2;
const formidable = require('formidable');

// 配置 Cloudinary，密钥将从 Netlify 环境变量中自动加载
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Netlify Function 的入口函数
exports.handler = async (event) => {
  // 严谨性检查：只接受 POST 方法
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    // 1. 使用 formidable 解析 multipart/form-data
    // 在 Netlify Function 中，formidable.parse(event, ...) 是处理文件上传的标准且可靠的方法。
    const uploadedFile = await new Promise((resolve, reject) => {
        const form = formidable({
            multiples: false,
            maxFileSize: 5 * 1024 * 1024, // 限制文件大小为 5MB (企业级实践)
        });
        
        form.parse(event, (err, fields, files) => {
            if (err) {
                console.error("Formidable解析错误:", err);
                return reject(new Error("文件解析失败。"));
            }
            
            // 'photo' 是我们在 index.html 中 input 标签的 name 属性
            const file = files.photo && files.photo[0]; 
            if (!file) {
                return reject(new Error("未找到上传文件，请确保文件已选择。"));
            }
            resolve(file);
        });
    });

    // 2. 将文件从临时路径上传到 Cloudinary
    const uploadResult = await cloudinary.uploader.upload(uploadedFile.filepath, {
      folder: 'christmas-photowall', // 在 Cloudinary 中创建特定文件夹管理图片
      tags: ['photowall', 'christmas'] // 添加标签，便于在 Cloudinary 后台搜索和管理
    });

    // 3. 返回上传成功的信息和 Cloudinary URL
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: uploadResult.secure_url, msg: 'Upload successful' }),
    };

  } catch (error) {
    console.error('上传功能失败:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ msg: '上传处理失败', error: error.message }),
    };
  }
};