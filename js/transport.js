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

      // 準備 payload，直接使用登入時存下來的 ID 與 Name
      const payload = {
        date: document.getElementById('medDate').value,
        barcode: barcodeValue,
        type: '傳送',
        staffId: transId,
        staffName: transName
      };

      // 立即在前端繪製處理中的卡片
      const cardId = 'card_' + Date.now();
      addCardToUI(payload, cardId, true);
      
      // ★ 核心防呆：清空並強制 focus (維持游標在窗格上)
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
      
      // 確保 API 呼叫結束後游標還是在上面
      barcodeInput.focus();
    }
  });

  // 4. 繪製放大版的卡片 UI
  function addCardToUI(data, cardId, isPending) {
    if (emptyState) emptyState.style.display = 'none';

    const card = document.createElement('div');
    card.id = cardId;
    card.className = `card mb-3 shadow-sm ${isPending ? 'border-warning' : 'border-success'} border-2`;
    
    const now = new Date();
    const timeString = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;

    // 使用 fs-3, fs-4 等 Bootstrap class 放大文字
    card.innerHTML = `
      <div class="card-body py-3 px-4">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h3 class="m-0 font-monospace text-dark fw-bold">${data.barcode}</h3>
          <span class="text-muted fs-4">${timeString}</span>
        </div>
        <div class="fs-4 text-secondary">
          <span class="badge bg-success me-2 py-2 px-3">${data.type}</span>
          <span class="fw-bold text-dark">${data.staffName}</span> (${data.staffId})
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
