// js/transport.js

document.addEventListener('DOMContentLoaded', () => {
  // 1. 檢查是否已登入 (讀取 sessionStorage)
  const transId = sessionStorage.getItem('transId');
  const transName = sessionStorage.getItem('transName');

  if (!transId || !transName) {
    Swal.fire('未授權', '請先登入', 'warning').then(() => {
      window.location.href = 'transport_login.html';
    });
    return;
  }

  // 顯示登入者名稱
  document.getElementById('displayUser').textContent = `${transName} (${transId})`;

  // 2. 初始化日期
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('medDate').value = today;

  const barcodeInput = document.getElementById('barcodeInput');
  const cardContainer = document.getElementById('cardContainer');
  const totalCountSpan = document.getElementById('totalCount');
  const emptyState = document.getElementById('emptyState');
  
  let scanCount = 0;

  // 確保一進畫面就 focus 條碼框
  barcodeInput.focus();

  // ★ 點擊頁面任何空白處，自動把焦點拉回條碼框 (防呆機制)
  document.body.addEventListener('click', (e) => {
    // 除非點擊的是按鈕或切換頁籤，否則焦點都在條碼框
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

      // === 條碼解析與防呆邏輯 ===
      const parts = barcodeValue.split(';');
      
      // 驗證 1: 結構必須夠長 (至少要有 5 個分號分隔出的段落)
      // 驗證 2: 領藥號 (parts[2]) 必須是 8 開頭
      if (parts.length < 5 || !parts[2] || !parts[2].startsWith('8')) {
        Swal.fire({
          icon: 'error',
          title: '條碼格式錯誤',
          text: '請確認是否刷對條碼，領藥號必須為 8 開頭！',
          timer: 2500
        });
        barcodeInput.value = '';
        barcodeInput.focus();
        return; // 終止執行，不寫入
      }

      // 提取資料
      const chartNo = parts[0]; // 病歷號
      const dispenseNo = parts[2]; // 領藥號
      const rawDateStr = parts[4]; // 處方日期 (例如 I202602050917239608592)
      
      // 使用正規表達式抓取英文字母後面的 8 個數字
      const dateMatch = rawDateStr.match(/[A-Za-z](\d{8})/);
      const rxDate = dateMatch ? dateMatch[1] : '';

      // 準備 payload，加入新解析的欄位
      const payload = {
        date: document.getElementById('medDate').value, // 今日日期
        barcode: barcodeValue,
        type: '傳送',
        staffId: transId,
        staffName: transName,
        chartNo: chartNo,
        dispenseNo: dispenseNo,
        rxDate: rxDate
      };

      // === 前端 UI 繪製 ===
      const cardId = 'card_' + Date.now();
      // 我們把領藥號當作卡片的醒目標題傳進去 (稍微修改 addCardToUI 的顯示)
      addCardToUI(payload, cardId, true); 
      
      barcodeInput.value = '';
      barcodeInput.focus();

      // 發送寫入請求
      const result = await callGAS('logDischargeMeds', { payload: payload });
      
      if (result.success) {
        document.getElementById(cardId).classList.replace('border-warning', 'border-success');
      } else {
        const errorCard = document.getElementById(cardId);
        errorCard.classList.replace('border-warning', 'border-danger');
        errorCard.querySelector('.card-body').innerHTML += `<div class="text-danger mt-2 fs-5 fw-bold">寫入失敗，請重試</div>`;
      }
      barcodeInput.focus();
    }
  });

  // 4. 繪製放大版的卡片 UI (修改為顯示領藥號與病歷號)
  function addCardToUI(data, cardId, isPending) {
    if (emptyState) emptyState.style.display = 'none';

    const card = document.createElement('div');
    card.id = cardId;
    card.className = `card mb-3 shadow-sm ${isPending ? 'border-warning' : 'border-success'} border-2`;
    
    const now = new Date();
    const timeString = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;

    card.innerHTML = `
      <div class="card-body py-3 px-4">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <!-- 醒目顯示領藥號與病歷號 -->
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
