const i18n = {
    zh: {
        authTitle: "🎄 圣诞派对入口", loginBtn: "进入派对", loading: "正在布置派对现场...",
        welcome: "，圣诞快乐！", uploadTitle: "🎁 投递圣诞记忆", chooseBtn: "选择照片",
        submitBtn: "立即上传", statusLoading: "🟡 正在打包礼物...", statusSuccess: "✨ 礼物已送达！"
    },
    en: {
        authTitle: "🎄 Christmas Entrance", loginBtn: "Entrance", loading: "Decorating the party...",
        welcome: ", Merry Christmas!", uploadTitle: "🎁 Drop a Memory", chooseBtn: "Choose Photo",
        submitBtn: "Upload Now", statusLoading: "🟡 Packing gift...", statusSuccess: "✨ Gift Delivered!"
    }
};

let currentLang = 'zh';
let currentUserName = "";

function switchLang(lang) {
    currentLang = lang;
    document.getElementById('t-auth-title').innerText = i18n[lang].authTitle;
    document.getElementById('t-login-btn').innerText = i18n[lang].loginBtn;
    document.getElementById('t-loading').innerText = i18n[lang].loading;
    document.getElementById('t-upload-title').innerText = i18n[lang].uploadTitle;
    document.getElementById('t-choose-btn').innerText = i18n[lang].chooseBtn;
    document.getElementById('t-submit-btn').innerText = i18n[lang].submitBtn;
}

// 物理粒子系统：雪花与金星
function startParticles() {
    const layer = document.getElementById('transition-layer');
    const snowInterval = setInterval(() => {
        const snow = document.createElement('div');
        snow.className = 'snowflake';
        const size = Math.random() * 5 + 2 + 'px';
        snow.style.width = size; snow.style.height = size;
        snow.style.left = Math.random() * 100 + 'vw';
        snow.style.top = '-10px';
        layer.appendChild(snow);
        snow.animate([{ transform: 'translateY(0)', opacity: 1 }, { transform: `translateY(100vh) translateX(${Math.random()*40-20}px)`, opacity: 0 }], { duration: 3000 });
        setTimeout(() => snow.remove(), 3000);
    }, 100);

    const starInterval = setInterval(() => {
        const star = document.createElement('div');
        star.className = 'falling-star';
        star.innerHTML = '★';
        star.style.left = Math.random() * 100 + 'vw';
        star.style.top = '-20px';
        layer.appendChild(star);
        star.animate([{ transform: 'translateY(0) rotate(0deg)', opacity: 1 }, { transform: `translateY(100vh) rotate(360deg)`, opacity: 0 }], { duration: 2000, easing: 'ease-in' });
        setTimeout(() => star.remove(), 2000);
    }, 400);

    return { snowInterval, starInterval };
}

async function handleLogin() {
    const nameInput = document.getElementById('username-input').value;
    if (!nameInput) return alert("Please enter your name!");
    
    currentUserName = nameInput;
    document.getElementById('auth-overlay').style.display = 'none';
    const transLayer = document.getElementById('transition-layer');
    transLayer.style.display = 'flex';

    const intervals = startParticles();
    
    // 异步并行加载照片
    const loadTask = loadPhotos();

    // 强制动画展示至少 3.5 秒
    setTimeout(async () => {
        await loadTask;
        clearInterval(intervals.snowInterval);
        clearInterval(intervals.starInterval);
        transLayer.style.opacity = '0';
        setTimeout(() => {
            transLayer.style.display = 'none';
            document.getElementById('main-content').style.display = 'block';
            document.getElementById('welcome-msg').innerText = currentUserName + i18n[currentLang].welcome;
        }, 800);
    }, 3500);
}

async function loadPhotos() {
    try {
        const res = await fetch('/api/get-photos'); // 对接你的 get-photos.js
        const data = await res.json();
        const grid = document.getElementById('photo-grid');
        grid.innerHTML = '';
        data.forEach(photo => {
            const rotate = (Math.random() * 6 - 3).toFixed(2);
            grid.innerHTML += `
                <div class="photo-card" style="transform: rotate(${rotate}deg)">
                    <img src="${photo.url}" alt="photo">
                    <div class="name-tag">${photo.name}</div>
                </div>`;
        });
    } catch (e) { console.error("Load failed", e); }
}

document.getElementById('photo-file').addEventListener('change', e => {
    document.getElementById('file-name-info').innerText = e.target.files[0] ? e.target.files[0].name : "...";
});

document.getElementById('uploadForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('t-submit-btn');
    const status = document.getElementById('upload-status');
    btn.disabled = true;
    status.innerText = i18n[currentLang].statusLoading;

    const formData = new FormData();
    formData.append('photo', document.getElementById('photo-file').files[0]);
    formData.append('uploader-name', currentUserName);

    try {
        const res = await fetch('/api/upload', { method: 'POST', body: formData }); // 对接你的 upload.js
        if (res.ok) {
            status.innerText = i18n[currentLang].statusSuccess;
            setTimeout(loadPhotos, 2000);
        }
    } catch (err) { status.innerText = "❌ Upload Failed"; }
    finally { btn.disabled = false; }
});