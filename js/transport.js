// js/transport.js

// ==========================================
// 音效模組 (使用瀏覽器內建 Web Audio API，無須外部音檔)
// ==========================================
function playSuccessSound() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(800, ctx.currentTime); // 高音「叮」
  gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.15);
}

function playErrorSound() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(150, ctx.currentTime); // 低沉警告音「叭」
  osc.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.3);
  gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
  gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.3);
}

// ==========================================
// 主程式邏輯
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  // 1. 檢查登入狀態
  const transId = sessionStorage.getItem('transId');
  const transName = sessionStorage.getItem('transName');

  if (!transId || !transName) {
    Swal.fire('未授權', '請先登入', 'warning').then(() => {
      window.location.href = 'transport_login.html';
    });
    return;
  }

  document.getElementById('displayUser').textContent = `${transName} (${transId})`;

  // 2. 初始化
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('medDate').value = today;

  const barcodeInput = document.getElementById('barcodeInput');
  const cardContainer = document.getElementById('cardContainer');
  const totalCountSpan = document.getElementById('totalCount');
  const emptyState = document.getElementById('emptyState');
  
  let scanCount = 0;
  barcodeInput.focus();

  // 點擊空白處自動拉回焦點
  document.body.addEventListener('click', (e) => {
    if (e.target.tagName !== 'BUTTON' && !e.target.classList.contains('nav-link')) {
       barcodeInput.focus();
    }
  });

  // 3. 處理條碼刷入
  barcodeInput.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const barcodeValue = barcodeInput.value.trim();
      if (!barcodeValue) return;

      // 驗證條碼格式
      const parts = barcodeValue.split(';');
      if (parts.length < 5 || !parts[2] || !parts[2].startsWith('8')) {
        playErrorSound(); // ★ 格式錯誤音效
        Swal.fire({
          icon: 'error',
          title: '條碼格式錯誤',
          text: '請確認是否刷對條碼，領藥號必須為 8 開頭！',
          timer: 2500
        });
        barcodeInput.value = '';
        barcodeInput.focus();
        return;
      }

      // 解析資料
      const chartNo = parts[0]; 
      const dispenseNo = parts[2]; 
      const rawDateStr = parts[4]; 
      const dateMatch = rawDateStr.match(/[A-Za-z](\d{8})/);
      const rxDate = dateMatch ? dateMatch[1] : '';

      const payload = {
        date: document.getElementById('medDate').value,
        barcode: barcodeValue,
        type: '傳送',
        staffId: transId,
        staffName: transName,
        chartNo: chartNo,
        dispenseNo: dispenseNo,
        rxDate: rxDate,
        overwrite: false
      };

      // ★ 核心改變 1：瞬間清空讓人員繼續盲刷，但「不馬上顯示在右側清單」
      barcodeInput.value = '';
      barcodeInput.focus();

      // 向後端發送驗證與寫入請求
      let result = await callGAS('logDischargeMeds', { payload: payload });
      
      // ★ 核心改變 2：後端回傳重複，立刻擋下並發出警告聲！
      if (result.isDuplicate) {
        playErrorSound(); // 播放警告音

        const ext = result.existingRecord;
        const alertHtml = `
          <div class="text-danger fw-bold fs-4 mb-3">此處方日期的領藥號已被簽收過！</div>
          <div class="card shadow-sm border-danger border-2 text-start mb-3">
            <div class="card-body py-3 px-4 bg-light">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <h3 class="m-0 text-danger fw-bold">領藥號：${ext.dispNo}</h3>
                <span class="text-muted fs-4">${ext.time}</span>
              </div>
              <div class="mb-2 fs-5 text-secondary">
                病歷號：<span class="fw-bold text-dark">${ext.chartNo}</span> | 處方日期：${ext.rxDate}
              </div>
              <div class="fs-5 text-secondary border-top pt-2">
                <span class="badge bg-danger me-2 fs-6">${ext.type}</span>
                已被 <span class="fw-bold text-danger">${ext.staffName}</span> (${ext.staffId}) 簽收
              </div>
            </div>
          </div>
          <div class="fs-5 text-dark mt-2">
            您確定要用 <span class="text-success fw-bold">${transName}</span> 的身分<br>覆蓋這筆紀錄嗎？
          </div>
        `;

        const confirmOverwrite = await Swal.fire({
          html: alertHtml,
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: '是，確認覆蓋',
          cancelButtonText: '否，取消',
          confirmButtonColor: '#198754',
          cancelButtonColor: '#6c757d',
          allowOutsideClick: false, // 防止誤觸關閉
          width: '600px'
        });

        if (confirmOverwrite.isConfirmed) {
          payload.overwrite = true;
          let overwriteResult = await callGAS('logDischargeMeds', { payload: payload });
          
          if (overwriteResult.success) {
            playSuccessSound(); // 覆蓋成功音效
            addCardToUI(payload, 'card_' + Date.now()); // 覆蓋成功才畫出卡片
          } else {
            playErrorSound();
            Swal.fire('錯誤', '覆蓋寫入失敗', 'error');
          }
        }
        barcodeInput.focus();
        return; // 結束這回合
      }

      // ★ 核心改變 3：不是重複且寫入成功，發出「叮」聲，卡片正式進駐清單！
      if (result.success) {
        playSuccessSound(); // 成功音效
        addCardToUI(payload, 'card_' + Date.now()); 
      } else if (!result.isDuplicate) {
        playErrorSound();
        Swal.fire('寫入失敗', '請重新刷入或檢查網路狀態', 'error');
      }
      
      barcodeInput.focus();
    }
  });

  // 4. 繪製卡片 UI (直接預設為成功狀態的綠色邊框)
  function addCardToUI(data, cardId) {
    if (emptyState) emptyState.style.display = 'none';

    const card = document.createElement('div');
    card.id = cardId;
    card.className = `card mb-3 shadow-sm border-success border-2`;
    
    const now = new Date();
    const timeString = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;

    card.innerHTML = `
      <div class="card-body py-3 px-4">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h3 class="m-0 text-success fw-bold">領藥號：${data.dispenseNo}</h3>
          <span class="text-muted fs-4">${timeString}</span>
        </div>
        <div class="mb-2 fs-5 text-secondary">
          病歷號：<span class="fw-bold text-dark">${data.chartNo}</span> | 處方日期：${data.rxDate}
        </div>
        <div class="fs-5 text-secondary border-top pt-2">
          <span class="badge bg-success me-2 fs-6">${data.type}</span>
          由 <span class="fw-bold text-dark">${data.staffName}</span> 簽收
        </div>
      </div>
    `;

    cardContainer.insertBefore(card, cardContainer.firstChild);
    scanCount++;
    totalCountSpan.textContent = scanCount;
  }
});

// 全域登出函數
function logout() {
  sessionStorage.removeItem('transId');
  sessionStorage.removeItem('transName');
  window.location.href = 'index.html';
}
