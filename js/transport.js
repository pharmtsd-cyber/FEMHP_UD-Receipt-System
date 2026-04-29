// js/transport.js

document.addEventListener('DOMContentLoaded', () => {
  // 1. 初始化日期 (隱藏欄位)
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('medDate').value = today;

  const dom = {
    staffId: document.getElementById('staffId'),
    staffName: document.getElementById('staffName'),
    btnClear: document.getElementById('btnClearStaff'),
    barcode: document.getElementById('barcodeInput'),
    cardContainer: document.getElementById('cardContainer'),
    totalCount: document.getElementById('totalCount'),
    emptyState: document.getElementById('emptyState')
  };
  
  let scanCount = 0;

  // 2. 清空按鈕邏輯
  dom.btnClear.addEventListener('click', () => {
    dom.staffId.value = '';
    dom.staffName.value = '';
    dom.barcode.value = '';
    dom.barcode.disabled = true;
    dom.barcode.placeholder = "請先驗證上方員工編號";
    dom.staffId.focus();
  });

  // 3. 員工編號驗證 (傳送人員專用)
  dom.staffId.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const id = dom.staffId.value.trim();
      
      if (!id) return;

      Swal.fire({ title: '驗證中...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

      // 呼叫 API，role 鎖定為 'transport'
      const result = await callGAS('verifyStaff', { staffId: id, role: 'transport' });
      
      if (result.success) {
        Swal.close();
        dom.staffName.value = result.name;
        unlockBarcode();
      } else {
        // 查無此人的特殊提示邏輯
        Swal.fire({
          title: '查無此人',
          text: '您是否為傳送人員？',
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: '是 (清空重來)',
          cancelButtonText: '否 (直接繼續)',
          confirmButtonColor: '#d33',
          cancelButtonColor: '#198754'
        }).then((alertResult) => {
          if (alertResult.isConfirmed) {
            dom.btnClear.click();
          } else {
            dom.staffName.value = '非名單人員';
            unlockBarcode();
          }
        });
      }
    }
  });

  function unlockBarcode() {
    dom.barcode.disabled = false;
    dom.barcode.placeholder = "請刷入藥袋條碼...";
    dom.barcode.focus();
  }

  // 4. 連續刷條碼邏輯
  dom.barcode.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const barcodeValue = dom.barcode.value.trim();
      if (!barcodeValue) return;

      const payload = {
        date: document.getElementById('medDate').value,
        barcode: barcodeValue,
        type: '傳送', // ★ 後台直接鎖定為傳送
        staffId: dom.staffId.value,
        staffName: dom.staffName.value
      };

      // 立即在前端繪製處理中的卡片
      const cardId = 'card_' + Date.now();
      addCardToUI(payload, cardId, true);
      
      // 清空並保持 focus
      dom.barcode.value = '';
      dom.barcode.focus();

      // 發送寫入請求
      const result = await callGAS('logDischargeMeds', { payload: payload });
      
      if (result.success) {
        document.getElementById(cardId).classList.replace('border-warning', 'border-success');
      } else {
        const errorCard = document.getElementById(cardId);
        errorCard.classList.replace('border-warning', 'border-danger');
        errorCard.querySelector('.card-body').innerHTML += `<div class="text-danger mt-1 small fw-bold">寫入失敗，請重試</div>`;
      }
    }
  });

  // 5. 繪製卡片 UI
  function addCardToUI(data, cardId, isPending) {
    if (dom.emptyState) dom.emptyState.style.display = 'none';

    const card = document.createElement('div');
    card.id = cardId;
    card.className = `card mb-2 shadow-sm ${isPending ? 'border-warning' : 'border-success'}`;
    
    const now = new Date();
    const timeString = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;

    card.innerHTML = `
      <div class="card-body py-2 px-3">
        <div class="d-flex justify-content-between align-items-center">
          <h5 class="m-0 font-monospace text-dark fw-bold">${data.barcode}</h5>
          <small class="text-muted">${timeString}</small>
        </div>
        <div class="mt-2 small text-secondary">
          <span class="badge bg-success me-1">${data.type}</span>
          <span class="fw-bold">${data.staffName}</span> (${data.staffId})
        </div>
      </div>
    `;

    dom.cardContainer.insertBefore(card, dom.cardContainer.firstChild);
    scanCount++;
    dom.totalCount.textContent = scanCount;
  }
});
