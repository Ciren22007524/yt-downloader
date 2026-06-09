const urlInput = document.getElementById('url-input');
const formatSelect = document.getElementById('format-select');
const qualitySelect = document.getElementById('quality-select');
const videoPreview = document.getElementById('video-preview');
const downloadForm = document.getElementById('download-form');
const footer = document.getElementById('status-footer');

// 1. 動態切換品質選項 (p vs kbps)
formatSelect.addEventListener('change', () => {
    qualitySelect.innerHTML = ''; // 清空選項

    if (formatSelect.value === 'mp3') {
        const options = [
            { text: '最佳音質 (Best)', value: '0' },
            { text: '極限音質 (320kbps)', value: '320' }, // 這是 MP3 的標準極限
            { text: '高品質 (256kbps)', value: '256' },
            { text: '標準音質 (192kbps)', value: '192' },
            { text: '低音質 (128kbps)', value: '128' }
        ];
        options.forEach(opt => {
            const el = document.createElement('option');
            el.value = opt.value;
            el.textContent = opt.text;
            if(opt.value === '0') el.selected = true;
            qualitySelect.appendChild(el);
        });
    } else {
        const options = [
            { text: '最佳品質', value: 'best' },
            { text: '2160p (4K)', value: '2160' },
            { text: '1440p (2K)', value: '1440' },
            { text: '1080p', value: '1080' },
            { text: '720p', value: '720' },
            { text: '480p', value: '480' }
        ];
        options.forEach(opt => {
            const el = document.createElement('option');
            el.value = opt.value;
            el.textContent = opt.text;
            if(opt.value === 'best') el.selected = true;
            qualitySelect.appendChild(el);
        });
    }
});

// 2. 預覽影片封面與相似度比對
urlInput.addEventListener('input', async () => {
    const { value: url } = urlInput;

    if (!url.includes('youtube.com/') && !url.includes('youtu.be/')) return;

    try {
        const response = await fetch(`/preview?url=${encodeURIComponent(url)}`);
        // 直接解構回傳的 JSON 物件
        const { thumbnail, title, similar_files, error } = await response.json();

        if (error) throw new Error(error);

        // 處理封面顯示
        if (thumbnail) {
            videoPreview.src = thumbnail;
            videoPreview.classList.remove('d-none');
        }

        const statusText = document.getElementById('status-text');
        const progressContainer = document.getElementById('progress-container');

        // 處理相似檔案邏輯
        if (similar_files?.length > 0) {
            footer.classList.remove('d-none');
            progressContainer.style.display = 'block';

            // 使用解構語法遍歷陣列並生成 HTML
            const listItems = similar_files.map(({ filename, score }) => {
                const isHighRisk = score > 0.8;
                const badgeClass = isHighRisk ? 'bg-danger-override' : 'bg-warning-override';

                return `
                    <div class="similar-file-item">
                        <span class="similar-file-name" title="${filename}">
                            • ${filename}
                        </span>
                        <span class="similar-file-badge ${badgeClass}">
                            ${(score * 100).toFixed(0)}%
                        </span>
                    </div>
                `;
            }).join('');

            statusText.classList.add('text-danger');
            statusText.innerHTML = `
                <div class="similar-files-title">
                    ⚠️ 發現庫中有相似檔案 (共 ${similar_files.length} 筆)：
                </div>
                <div class="similar-files-container">
                    <div class="similar-files-list">
                        ${listItems}
                    </div>
                </div>
                <div class="ignore-prompt-text">若確定要下載請忽略提示並點擊下方按鈕</div>
            `;
        } else {
            statusText.classList.remove('text-danger');
            statusText.innerHTML = '<span class="text-success small fw-bold">✨ 庫中無重複，準備下載...</span>';
        }
    } catch (e) {
        console.error("預覽失敗:", e);
    }
});

// 3. 處理下載
downloadForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // 顯示轉圈圈
    footer.classList.remove('d-none');
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    const formData = new FormData(e.target);
    try {
        const response = await fetch('/download', { method: 'POST', body: formData });
        const result = await response.json();

        // 這裡要配合後端回傳的 "started"
        if (result.status === 'started') {
            console.log("下載已在背景啟動，請觀察進度條");
            // 這裡可以不用 alert，因為進度條會自己跳出來
        } else {
            alert('發生錯誤：' + (result.message || '未知錯誤'));
            footer.classList.add('d-none');
            submitBtn.disabled = false;
        }
    } catch (error) {
        alert('連線失敗');
        footer.classList.add('d-none');
        submitBtn.disabled = false;
    }

    // 注意：這裡不要在 finally 裡立刻把按鈕改回可用，
    // 應該等 WebSocket 收到「✅ 下載已完成！」才把按鈕恢復。
});

const syncBtn = document.getElementById('sync-btn');
const dbStatus = document.getElementById('db-status');
const fileList = document.getElementById('file-list');
const pathDisplay = document.getElementById('library-path-display');
const browseBtn = document.getElementById('browse-path-btn');
const pathStatus = document.getElementById('path-status');

// 更新側邊欄清單的函式
async function refreshLibraryStatus() {
    try {
        const response = await fetch('/db/status');
        const data = await response.json();

        // 更新側邊欄顯示的路徑（確保與後端 config 一致）
        if (pathDisplay && data.current_path) {
            pathDisplay.textContent = data.current_path;
        }

        dbStatus.innerText = `目前庫中共有 ${data.count || 0} 個檔案`;

        if (data.files && data.files.length > 0) {
            fileList.innerHTML = data.files.map(f =>
                `<li class="list-group-item py-1" style="font-size: 0.8rem;">${f}</li>`
            ).join('');
        } else {
            fileList.innerHTML = '<li class="list-group-item py-1 text-muted text-center">庫中尚無檔案</li>';
        }
    } catch (e) {
        console.error("無法同步狀態", e);
    }
}

// 同步按鈕點擊
syncBtn.addEventListener('click', async () => {
    syncBtn.disabled = true;
    syncBtn.innerText = '同步中...';

    try {
        const response = await fetch('/db/sync', { method: 'POST' });
        const result = await response.json();
        if (result.status === 'success') {
            alert(`同步完成！共索引 ${result.count} 個檔案`);
            await refreshLibraryStatus();
        }
    } catch (e) {
        alert('同步失敗');
    } finally {
        syncBtn.disabled = false;
        syncBtn.innerText = '🔄 同步本地資料夾 (建立索引)';
    }
});

// 頁面載入後先跑一次狀態更新
refreshLibraryStatus();

// 選擇資料夾
browseBtn.addEventListener('click', async () => {
    browseBtn.disabled = true;
    browseBtn.innerText = '📁 選擇中...';

    try {
        const response = await fetch('/config/browse');
        const result = await response.json();

        if (result.status === 'success') {
            pathDisplay.textContent = result.path;
            pathStatus.classList.remove('d-none');
            setTimeout(() => pathStatus.classList.add('d-none'), 2000);
            await refreshLibraryStatus();
        } else if (result.status !== 'cancelled') {
            alert('路徑設定失敗：' + result.message);
        }
    } catch (e) {
        alert('連線失敗');
    } finally {
        browseBtn.disabled = false;
        browseBtn.innerText = '📁 選擇資料夾';
    }
});