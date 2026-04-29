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

      const parts = barcodeValue.split(';');
      if (parts.length < 5 || !parts[2] || !parts[2].startsWith('8')) {
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
        overwrite: false // 預設不是覆蓋模式
      };

      // 先在畫面上畫出黃色的「處理中」卡片
      const cardId = 'card_' + Date.now();
      addCardToUI(payload, cardId, true); 
      
      barcodeInput.value = '';
      barcodeInput.focus();

      // 發送第一次寫入請求
      let result = await callGAS('logDischargeMeds', { payload: payload });
      
      // ★ 判斷是否遇到重複紀錄
      if (result.isDuplicate) {
        // 先把剛剛畫在畫面上的黃色卡片抽掉，並扣回總筆數
        const pendingCard = document.getElementById(cardId);
        if (pendingCard) pendingCard.remove();
        scanCount--;
        totalCountSpan.textContent = scanCount;

        const ext = result.existingRecord;
        
        // 組裝與側邊清單長得一模一樣的 HTML 卡片
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

        // 彈出確認視窗
        const confirmOverwrite = await Swal.fire({
          html: alertHtml,
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: '是，確認覆蓋',
          cancelButtonText: '否，取消',
          confirmButtonColor: '#198754',
          cancelButtonColor: '#6c757d',
          width: '600px' // 讓卡片不要被擠壓
        });

        // 如果選擇覆蓋
        if (confirmOverwrite.isConfirmed) {
          payload.overwrite = true; // 開啟覆蓋模式
          addCardToUI(payload, cardId, true); // 再次畫出黃色卡片
          result = await callGAS('logDischargeMeds', { payload: payload }); // 發送第二次請求
        } else {
          // 如果選擇取消，就當作沒事發生，游標回到輸入框
          barcodeInput.focus();
          return;
        }
      }

      // 最終處理結果 (成功新增 或 成功覆蓋)
      if (result.success) {
        const targetCard = document.getElementById(cardId);
        if(targetCard) targetCard.classList.replace('border-warning', 'border-success');
      } else if (!result.isDuplicate) { // 避免重複報錯
        const errorCard = document.getElementById(cardId);
        if(errorCard){
          errorCard.classList.replace('border-warning', 'border-danger');
          errorCard.querySelector('.card-body').innerHTML += `<div class="text-danger mt-2 fs-5 fw-bold">寫入失敗，請重試</div>`;
        }
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
