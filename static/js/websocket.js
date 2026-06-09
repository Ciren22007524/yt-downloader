const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
const socket = new WebSocket(`${wsProtocol}://${window.location.host}/ws`);

function showDownloadNotice(message, level = 'success') {
    const notice = document.getElementById('download-notice');
    const noticeBody = document.getElementById('download-notice-body');
    if (!notice || !noticeBody) return;

    noticeBody.className = `alert alert-${level} mb-0`;
    noticeBody.textContent = message;
    notice.style.display = 'block';

    if (level === 'success') {
        setTimeout(() => {
            notice.style.display = 'none';
        }, 5000);
    }
}

socket.onopen = function() {
    console.log('WebSocket connected');
};

socket.onerror = function() {
    showDownloadNotice('WebSocket 連線異常，可能無法收到完成通知。', 'warning');
};

socket.onmessage = function(event) {
    const msg = JSON.parse(event.data);
    const bar = document.getElementById('progress-bar');
    const status = document.getElementById('status-text');
    const container = document.getElementById('progress-container');

    container.style.display = 'block';

    if (msg.type === 'progress') {
        // 處理進度條更新
        bar.style.width = msg.data + '%';
        status.innerText = `下載中: ${msg.data}%`;
    } else if (msg.type === 'status') {
        // 1. 先更新狀態文字（無論是否完成都要顯示）
        status.innerText = msg.data;

        // 2. 接著判斷這條 status 訊息是否代表「結束」
        if (msg.data.includes('✅')) {
            const submitBtn = document.querySelector('#download-form button[type="submit"]');
            const footer = document.getElementById('status-footer');

            if (submitBtn) submitBtn.disabled = false;
            if (footer) footer.classList.add('d-none');

            showDownloadNotice(msg.data, 'success');
        } else if (msg.data.includes('❌')) {
            const submitBtn = document.querySelector('#download-form button[type="submit"]');
            if (submitBtn) submitBtn.disabled = false;
            showDownloadNotice(msg.data, 'danger');
        }
    }
};