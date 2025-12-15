// api/get-photos.js (新增文件)
// 假设 Netlify DB SDK 存在
const { getRecords } = require('netlify-data-sdk'); 

exports.handler = async (event) => {
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        // 假设我们从名为 'photos' 的表中获取所有记录
        const photos = await getRecords('photos'); 

        // 整理数据，只返回 URL 和名字
        const photoList = photos.map(record => ({
            url: record.photoUrl, 
            name: record.uploaderName,
            timestamp: record.timestamp
        })).sort((a, b) => b.timestamp - a.timestamp); // 按时间倒序排列

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(photoList),
        };

    } catch (error) {
        console.error('获取照片列表失败:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ msg: '无法加载照片历史记录', error: error.message }),
        };
    }
};