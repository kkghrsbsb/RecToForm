// 获取/生成 user_id
function getUserId() {
    return 'u_' + Math.random().toString(36).slice(2, 10);
}

const userId = getUserId();

const fileInput = document.getElementById('fileInput');
const uploadSuccessMessage = document.getElementById('uploadSuccessMessage');
const uploadButton = document.getElementById('uploadButton');
const analyzeButton = document.getElementById('analyzeButton');
const downloadButton = document.getElementById('downloadButton');

const validExts = ['.pdf', '.ofd'];
let websocket, progress = 0, downloadUrl = null;
let step = 'upload';

// 消息观察器
const messagesObserver = new MutationObserver(() => {
    scrollToBottom();
});

function updateButtonStates() {
    uploadButton.classList.remove('active');
    analyzeButton.classList.remove('active');
    downloadButton.classList.remove('active');

    uploadButton.disabled = step !== 'upload';
    analyzeButton.disabled = step !== 'analyze';
    downloadButton.disabled = step !== 'download';

    [uploadButton, analyzeButton, downloadButton].forEach(btn => {
        if (!btn.disabled) btn.classList.add('active');
    });
}

function addMessage(text, type = 'normal') {
    requestAnimationFrame(() => {
        const messageDiv = document.createElement("div");
        messageDiv.textContent = text;
        messageDiv.className = `message-${type}`;
        messages.appendChild(messageDiv);
    });
}

function addMessageSuccess(text, type = 'success') {
    requestAnimationFrame(() => {
        const messageDiv = document.createElement("div");
        messageDiv.textContent = text;
        messageDiv.className = `message-${type}`;
        messages.appendChild(messageDiv);
    });
}

function scrollToBottom() {
    const lastMessage = messages.lastElementChild;
    if (lastMessage) {
        lastMessage.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest'
        });
    }
}

fileInput.addEventListener('change', () => {
    handleFiles(Array.from(fileInput.files));
    fileInput.value = '';
});

async function handleFiles(files) {
    const legal = files.filter(file =>
        validExts.some(ext => file.name.toLowerCase().endsWith(ext))
    );
    if (legal.length === 0) {
        addMessage("错误：请上传 PDF 或 OFD 格式的文件");
        return;
    }
    await uploadFiles(legal);
}

async function uploadFiles(files) {
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));

    try {
        const response = await fetch(`http://127.0.0.1:56112/upload?user_id=${encodeURIComponent(userId)}`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            let errorDetail = '';
            try {
                const errorResponse = await response.json();
                errorDetail = errorResponse.detail || errorResponse.message || JSON.stringify(errorResponse);
            } catch (e) {
                errorDetail = await response.text();
            }
            addMessage(errorDetail, response.status === 400 ? 'error' : 'normal');
            return;
        }

        await response.text();
        showUploadSuccess();
        step = 'analyze';
        updateButtonStates();
    } catch (err) {
        addMessage(`上传失败: ${err.message}`, 'error');
    }
}

function startWebSocket() {
    if (step !== 'analyze') return;

    if (websocket?.readyState === WebSocket.OPEN) return;

    analyzeButton.innerHTML = '<span class="analyzing">制表中<span class="dots">...</span></span>';
    analyzeButton.disabled = true;

    const style = document.createElement('style');
    style.textContent = `
        @keyframes dotPulse {
            0%, 100% { opacity: 0.3; }
            50% { opacity: 1; }
        }
        .analyzing .dots span {
            animation: dotPulse 1.4s infinite;
            display: inline-block;
        }
        .analyzing .dots span:nth-child(1) {
            animation-delay: 0s;
        }
        .analyzing .dots span:nth-child(2) {
            animation-delay: 0.2s;
        }
        .analyzing .dots span:nth-child(3) {
            animation-delay: 0.4s;
        }
    `;
    document.head.appendChild(style);

    const dots = analyzeButton.querySelector('.dots');
    dots.innerHTML = '<span>.</span><span>.</span><span>.</span>';

    websocket = new WebSocket(`ws://127.0.0.1:56112/analyze?user_id=${encodeURIComponent(userId)}`);

    websocket.onopen = () => {
        console.log("WebSocket连接已建立");
        websocket.send("开始分析");
    };

    websocket.onmessage = (event) => {
        const message = event.data;

        if (message.includes('表格下载链接:')) {
            progress = 100;
            updateProgressBar(progress);
            // 解析下载链接并带上 user_id
            const urlMatch = message.match(/表格下载链接:\s*(.*)/);
            if (urlMatch) {
                downloadUrl = urlMatch[1].trim();
            } else {
                downloadUrl = `http://127.0.0.1:56112/download?user_id=${encodeURIComponent(userId)}`;
            }
            step = 'download';
            updateButtonStates();
            addMessageSuccess("分析完成，点击“下载表格”，获得Excel文件");

            analyzeButton.innerHTML = '开始制表';
            return;
        }

        addMessage(message);
        if (progress < 90) progress += 10;
        updateProgressBar(progress);
    };

    websocket.onclose = () => {
        console.log("WebSocket连接已关闭");
        analyzeButton.innerHTML = '开始制表';
    };

    websocket.onerror = (error) => {
        if (error.data) {
            try {
                const errorData = JSON.parse(error.data);
                addMessage(errorData.detail || errorData.message || error.data, 'error');
            } catch (e) {
                addMessage(error.data, 'error');
            }
        } else {
            addMessage('制表过程中发生错误', 'error');
        }
        analyzeButton.innerHTML = '开始制表';
    };
}

analyzeButton.addEventListener('click', () => {
    startWebSocket();
});

downloadButton.addEventListener('click', () => {
    if (step === 'download' && downloadUrl) {
        window.open(downloadUrl, '_blank');
        resetState();
    }
});

function resetState() {
    progress = 0;
    downloadUrl = null;
    step = 'upload';
    updateProgressBar(progress);
    updateButtonStates();
    addMessageSuccess("下载完成！可以继续上传 PDF 或 OFD 文件分析");
}

function updateProgressBar(value) {
    progressBar.style.width = `${value}%`;
    progressText.textContent = `${value}%`;
}

function showUploadSuccess() {
    uploadSuccessMessage.style.display = 'block';
    setTimeout(() => {
        uploadSuccessMessage.style.display = 'none';
    }, 3000);
}

document.addEventListener('DOMContentLoaded', () => {
    messagesObserver.observe(messages, { childList: true });

    const initialMessages = [
        { text: "发票信息自助填表（提取发票代码、发票号、发票金额）", type: "warning" },
        { text: "作者：Yunxi_Zhu, Xinger", type: "warning" },
        { text: "请上传 PDF 或 OFD 文件以开始分析（可多选文件）", type: "warning" },
        { text: "------------------------------------------------------------------------------------", type: "divider" }
    ];

    initialMessages.forEach(msg => addMessage(msg.text, msg.type));
    updateButtonStates();
});