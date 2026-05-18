// js/transport.js
let globalDocConfigs = [];

// ==========================================
// 音效模組
// ==========================================
function playSuccessSound() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(800, ctx.currentTime); 
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
  osc.frequency.setValueAtTime(150, ctx.currentTime); 
  osc.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.3);
  gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
  gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.3);
}

// ==========================================
// 主邏輯控制塊 (已將所有的 DOMContentLoaded 完美合併)
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  // 1. 權限檢查
  const transId = sessionStorage.getItem('transId');
  const transName = sessionStorage.getItem('transName');

  if (!transId || !transName) {
    Swal.fire('未授權', '請先登入', 'warning').then(() => {
      window.location.href = 'transport_login.html'; 
    });
    return;
  }
  document.getElementById('displayUser').textContent = `${transName} (${transId})`;

  // 2. 設定今日日期
  const today = new Date().toISOString().split('T')[0];
  const medDateInput = document.getElementById('medDate');
  if(medDateInput) medDateInput.value = today;

  // 3. 初始化文件選單與清單
  if(document.getElementById('docTypeSelect')) {
    await loadDocConfig();
    loadTodayDocs();
  }

  // 4. 出院帶藥條碼輸入邏輯
  const barcodeInput = document.getElementById('barcodeInput');
  const totalCountSpan = document.getElementById('totalCount');
  const scannedItems = new Set();
  
  if(barcodeInput) {
    barcodeInput.focus();
    document.body.addEventListener('click', (e) => {
      if (e.target.tagName !== 'BUTTON' && !e.target.classList.contains('nav-link') && e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT') {
         barcodeInput.focus();
      }
    });

    barcodeInput.addEventListener('keypress', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const barcodeValue = barcodeInput.value.trim();
        if (!barcodeValue) return;

        const parts = barcodeValue.split(';');
        if (parts.length < 5 || !parts[2] || !parts[2].startsWith('8')) {
          playErrorSound(); 
          Swal.fire({ icon: 'error', title: '條碼格式錯誤', text: '請確認是否刷對條碼，領藥號必須為 8 開頭！', timer: 2000 });
          barcodeInput.value = '';
          return;
        }

        const chartNo = parts[0]; 
        const dispenseNo = parts[2]; 
        const rawDateStr = parts[4]; 
        const dateMatch = rawDateStr.match(/[A-Za-z](\d{8})/);
        const rxDate = dateMatch ? dateMatch[1] : '';

        const itemKey = `${dispenseNo}-${rxDate}`;
        const isNewItem = !pScannedItems.has(itemKey);
        
        let finalTaskType = '氣送'; // 預設狀態
        let isDuplicateLabel = false;
        let isCancelDispense = false;

        if (isNewItem) {
          pScannedItems.add(itemKey);
        } else {
          playErrorSound();
          const { value: userChoice } = await Swal.fire({
            title: '⚠️ 重複刷入提示',
            text: `領藥號 ${dispenseNo} 剛剛已經刷入過了！請問您要：`,
            icon: 'warning',
            showDenyButton: true,
            showCancelButton: true,
            confirmButtonText: '覆蓋重刷 (維持氣送)',
            denyButtonText: '取消領藥',
            cancelButtonText: '取消動作 (不記錄)',
            confirmButtonColor: '#198754',
            denyButtonColor: '#dc3545',
            allowOutsideClick: false
          });

          if (userChoice === true) {
            finalTaskType = '氣送';
            isDuplicateLabel = true;
          } else if (userChoice === false) {
            finalTaskType = '取消領藥';
            isDuplicateLabel = true;
            isCancelDispense = true;
          } else {
            pBarcodeInput.value = '';
            pBarcodeInput.focus();
            return;
          }
        }

        const payload = {
          date: pDateInput.value,
          barcode: barcodeValue,
          type: finalTaskType, // 動態狀態
          staffId: currentPharmaId,
          staffName: currentPharmaName,
          chartNo: chartNo,
          dispenseNo: dispenseNo,
          rxDate: rxDate
        };

        const cardId = 'p_card_' + Date.now();
        
        if (isNewItem) {
          addPneumaticCardToUI(payload, cardId, true); 
          pTotalCountSpan.textContent = pScannedItems.size;
        } else {
          addPneumaticCardToUI(payload, cardId, true, isDuplicateLabel, isCancelDispense); 
        }
        
        pBarcodeInput.value = '';
        pBarcodeInput.focus();

        const result = await callGAS('logDischargeMeds', payload);
        
        if (result.success) {
          playSuccessSound(); 
          const successCard = document.getElementById(cardId);
          if(successCard) successCard.classList.replace('border-warning', 'border-success');
        } else {
          playErrorSound();
          const errorCard = document.getElementById(cardId);
          if(errorCard){
            errorCard.classList.replace('border-warning', 'border-danger');
            errorCard.querySelector('.card-body').innerHTML += `<div class="text-danger mt-1 fs-6 fw-bold">寫入失敗</div>`;
          }
        }
      }
    });
  }

  // 5. 監聽文件類型下拉選單 (動態長出欄位)
  const docTypeSelect = document.getElementById('docTypeSelect');
  const container = document.getElementById('dynamicFieldsContainer');
  if (docTypeSelect && container) {
    docTypeSelect.addEventListener('change', (e) => {
      const selectedType = e.target.value;
      container.innerHTML = '';
      if (!selectedType) {
        container.innerHTML = '<div class="text-muted text-center py-4 fs-5">請先選擇送件類型</div>';
        return;
      }
      const config = globalDocConfigs.find(c => (c['送件類型名稱'] || c.Title) === selectedType);
      if (!config) return;

      let html = '';
      const excludeKeys = ['Title', '送件類型名稱'];
      Object.keys(config).forEach(key => {
        if (!excludeKeys.includes(key)) {
          const requirement = config[key]; 
          if (requirement !== '隱藏') {
            const isRequired = requirement === '必填' ? 'required' : '';
            const star = requirement === '必填' ? '<span class="text-danger">*</span>' : '<span class="text-muted fs-6">(選填)</span>';
            html += `
              <div class="mb-3 text-start">
                <label class="form-label fw-bold fs-5">${key} ${star}</label>
                <input type="text" class="form-control form-control-lg dynamic-input" data-key="${key}" placeholder="請輸入${key}" ${isRequired}>
              </div>
            `;
          }
        }
      });
      if (html === '') html = '<div class="text-success text-center py-3 fw-bold"><i class="bi bi-check-circle me-2"></i>此文件不需填寫額外資料，請直接送出</div>';
      container.innerHTML = html;
    });
  }

  // 6. 攔截表單送出 (抓取最新四個欄位)
  const docForm = document.getElementById('docForm');
  if (docForm) {
    docForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const wardInput = document.querySelector('input[data-key="病房床號"]');
      const chartInput = document.querySelector('input[data-key="病歷號"]');
      const qtyInput = document.querySelector('input[data-key="數量/張數"]');
      const pickupInput = document.querySelector('input[data-key="領藥號"]');

      const payload = {
        type: document.getElementById('docTypeSelect').value,
        ward: wardInput ? wardInput.value.trim() : '',
        chartNo: chartInput ? chartInput.value.trim() : '',
        quantity: qtyInput ? qtyInput.value.trim() : '',
        pickupNo: pickupInput ? pickupInput.value.trim() : '',
        sendNote: document.getElementById('docNote').value.trim(),
        senderId: sessionStorage.getItem('transId'),
        senderName: sessionStorage.getItem('transName')
      };

      const btn = document.getElementById('btnSubmitDoc');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>傳送中...';

      const res = await callGAS('submitDocTransfer', payload);

      if (res.success) {
        Swal.fire({ icon: 'success', title: '送件成功', text: `系統單號: ${res.signId}`, timer: 2000 });
        docForm.reset();
        document.getElementById('dynamicFieldsContainer').innerHTML = '<div class="text-muted text-center py-4 fs-5">請先選擇送件類型</div>';
        loadTodayDocs(); 
      } else {
        Swal.fire('失敗', res.message, 'error');
      }
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-send-fill me-2"></i>確認送出';
    });
  }

  // 7. 綁定重整按鈕與頁籤切換
  const btnRefreshDoc = document.getElementById('btnRefreshDoc');
  if (btnRefreshDoc) btnRefreshDoc.addEventListener('click', loadTodayDocs);
  const docTab = document.getElementById('doc-tab');
  if (docTab) docTab.addEventListener('shown.bs.tab', loadTodayDocs);
});

// ==========================================
// 各項獨立輔助函數
// ==========================================
function addCardToUI(data, cardId, isPending, isDuplicate = false, isCancel = false) {
  const container = document.getElementById('cardContainer');
  const emptyState = document.getElementById('emptyState');
  if (emptyState) emptyState.style.display = 'none';
  
  const card = document.createElement('div');
  card.id = cardId;
  card.className = `card mb-3 shadow-sm ${isPending ? 'border-warning' : 'border-success'} border-2`;
  
  const now = new Date();
  const timeString = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;

  card.innerHTML = `
    <div class="card-body py-3 px-4">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <h3 class="m-0 ${isCancel ? 'text-danger' : 'text-success'} fw-bold">領藥號：${data.dispenseNo} 
          ${isDuplicate && !isCancel ? '<span class="badge bg-warning text-dark fs-6 ms-2">重複刷入</span>' : ''}
          ${isCancel ? '<span class="badge bg-danger text-white fs-6 ms-2">取消領藥</span>' : ''}
        </h3>
        <span class="text-muted fs-4">${timeString}</span>
      </div>
      <div class="row">
        <div class="col-12 fs-5 text-secondary">病歷號：<span class="fw-bold text-dark">${data.chartNo}</span> | 處方日期：${data.rxDate} 
        ${isCancel ? `<span class="badge bg-danger ms-2">${data.type}</span>` : ''}</div>
      </div>
    </div>`;
  container.insertBefore(card, container.firstChild);
}

async function loadDocConfig() {
  const select = document.getElementById('docTypeSelect');
  if(!select) return;
  select.innerHTML = '<option value="">資料載入中...</option>';
  try {
    const response = await callGAS('getConfigData'); 
    if (response.success && response.data) {
      globalDocConfigs = response.data; 
      select.innerHTML = '<option value="">請選擇類型...</option>';
      response.data.forEach(item => {
          const opt = document.createElement('option');
          const val = item['送件類型名稱'] || item.Title;
          opt.value = val;
          opt.textContent = val;
          select.appendChild(opt);
      });
    } else {
      select.innerHTML = '<option value="">無法取得選單</option>';
    }
  } catch (err) {
    select.innerHTML = '<option value="">連線失敗</option>';
  }
}

async function loadTodayDocs() {
  const container = document.getElementById('docRecordContainer');
  const btn = document.getElementById('btnRefreshDoc');
  if (!container) return;

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>讀取中';
  }
  container.innerHTML = '<div class="text-muted text-center py-5 fs-5">資料讀取中...</div>';

  const res = await callGAS('getTodayDocRecords');

  if (res.success) {
    if (res.data.length === 0) {
      container.innerHTML = '<div class="text-muted text-center py-5 fs-5">今日尚無未結案的紀錄</div>';
    } else {
      // ★ 修正：在資料成功取回後進行排序 (最新時間排最上)
      const sortedData = res.data.sort((a, b) => {
        const timeA = new Date(a.sendTime || a.SendTime || 0);
        const timeB = new Date(b.sendTime || b.SendTime || 0);
        return timeB - timeA;
      });

      container.innerHTML = sortedData.map(item => {
        let details = [];
        if (item.ward) details.push(`病房: <span class="fw-bold text-primary fs-5 align-middle">${item.ward}</span>`);
        if (item.chartNo) details.push(`病歷: <span class="fw-bold text-dark fs-5 align-middle">${item.chartNo}</span>`);
        
        // 數量與領藥號稍微放大 (fs-6) 以搭配整體比例
        if (item.quantity) details.push(`數量: <span class="text-danger fw-bold fs-6 align-middle">${item.quantity}</span>`);
        if (item.pickupNo) details.push(`領藥號: <span class="text-success fw-bold fs-6 align-middle">${item.pickupNo}</span>`);

        const args = `'${item.signId}', '${item.type}', '${item.ward || ''}', '${item.chartNo || ''}', '${item.quantity || ''}', '${item.pickupNo || ''}', '${item.sendNote || ''}'`;

        return `
        <div class="card mb-3 shadow-sm border-start border-4 ${item.status === '待藥師收單' ? 'border-warning' : (item.status === '退件' ? 'border-danger' : 'border-primary')}">
          <div class="card-body p-3">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <span class="badge ${item.status === '待藥師收單' ? 'bg-warning text-dark' : (item.status === '退件' ? 'bg-danger' : 'bg-primary')} fs-6">${item.status}</span>
              <span class="text-muted small">${item.sendTime}</span>
            </div>
            <h5 class="fw-bold text-dark mb-1">${item.type}</h5>
            
            <div class="text-secondary mb-2 mt-2 lh-base">
              ${details.join('<span class="mx-2 text-black-50 fw-light">|</span>')}
            </div>
            
            ${item.sendNote ? `<div class="text-danger small mb-2 bg-light p-1 rounded border"><i class="bi bi-chat-left-text me-1"></i>送件備註: ${item.sendNote}</div>` : ''}
            
            <div class="d-flex justify-content-between align-items-end mt-2 pt-2 border-top">
              <div class="small text-muted">
                <i class="bi bi-person-walking"></i> 送件: ${item.sender}<br>
                <i class="bi bi-capsule"></i> 藥師: <span class="${item.pharmaName === '等待中' ? 'text-danger' : 'text-primary'}">${item.pharmaName}</span>
              </div>
              <div>
                ${(item.status === '掛牌待傳送領回' || item.status === '退件') ? `<button class="btn btn-sm btn-success fw-bold" onclick="acknowledgeReturn('${item.signId}')">確認領回</button>` : ''}
                ${item.status === '待藥師收單' ? `<button class="btn btn-sm btn-outline-primary fw-bold" onclick="editSenderDoc(${args})"><i class="bi bi-pencil-square me-1"></i>修改資料</button>` : ''}
              </div>
            </div>
          </div>
        </div>`;
      }).join('');
    }
  } else {
    container.innerHTML = '<div class="text-danger text-center py-5 fs-5">連線失敗</div>';
  }

  if (btn) {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-arrow-clockwise me-1"></i>重整';
  }
}

async function editSenderDoc(signId, currentType, currentWard, currentChartNo, currentQty, currentPickup, currentSendNote) {
  const safeWard = (!currentWard || currentWard === 'undefined' || currentWard === 'null') ? '' : currentWard;
  const safeChartNo = (!currentChartNo || currentChartNo === 'undefined' || currentChartNo === 'null') ? '' : currentChartNo;
  const safeQty = (!currentQty || currentQty === 'undefined' || currentQty === 'null') ? '' : currentQty;
  const safePickup = (!currentPickup || currentPickup === 'undefined' || currentPickup === 'null') ? '' : currentPickup;
  const safeSendNote = (!currentSendNote || currentSendNote === 'undefined' || currentSendNote === 'null') ? '' : currentSendNote;

  const typeOptions = globalDocConfigs.map(c => {
    const val = c['送件類型名稱'] || c.Title;
    return `<option value="${val}" ${val === currentType ? 'selected' : ''}>${val}</option>`;
  }).join('');

  const { value: formValues } = await Swal.fire({
    title: '修改送件資料',
    html: `
      <div class="text-start g-2 mb-3">
        <div class="mb-2"><label class="small fw-bold text-muted">文件類型</label><select id="swal-type" class="form-select">${typeOptions}</select></div>
        <div class="mb-2"><label class="small fw-bold text-muted">病房床號 (6碼英數)</label><input id="swal-ward" class="form-control" value="${safeWard}" placeholder="例如: 8A1234" maxlength="6"></div>
        <div class="mb-2"><label class="small fw-bold text-muted">病歷號</label><input id="swal-chart" class="form-control" value="${safeChartNo}"></div>
        <div class="row">
          <div class="col-6 mb-2"><label class="small fw-bold text-muted">數量/張數</label><input id="swal-qty" class="form-control" value="${safeQty}"></div>
          <div class="col-6 mb-2"><label class="small fw-bold text-muted">領藥號</label><input id="swal-pickup" class="form-control" value="${safePickup}"></div>
        </div>
        <div class="mb-2"><label class="small fw-bold text-muted">送件備註</label><input id="swal-note" class="form-control" value="${safeSendNote}"></div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: '確認修改',
    preConfirm: () => {
      const wardVal = document.getElementById('swal-ward').value.trim();
      if (wardVal !== '' && !/^[A-Za-z0-9]{6}$/.test(wardVal)) {
        Swal.showValidationMessage('病房床號格式錯誤，必須是 6 位數的英文與數字組合');
        return false;
      }
      return {
        type: document.getElementById('swal-type').value,
        ward: wardVal,
        chartNo: document.getElementById('swal-chart').value.trim(),
        quantity: document.getElementById('swal-qty').value.trim(),
        pickupNo: document.getElementById('swal-pickup').value.trim(),
        sendNote: document.getElementById('swal-note').value.trim()
      }
    }
  });

  if (formValues) {
    const res = await callGAS('editSenderDoc', { signId: signId, ...formValues });
    if (res.success) {
      Swal.fire({ icon: 'success', title: '修改成功', timer: 1500, showConfirmButton: false });
      loadTodayDocs(); 
    }
  }
}

function logout() {
  sessionStorage.clear();
  window.location.href = 'index.html';
}

// === 傳送人員確認領回 (退件或掛牌待傳送領回) ===
async function acknowledgeReturn(signId) {
  const transId = sessionStorage.getItem('transId');
  const transName = sessionStorage.getItem('transName');

  const { isConfirmed } = await Swal.fire({
    title: '確認領回文件？',
    text: '領回後此單據將正式結案，不再顯示於目前的清單中。',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#198754', // 綠色確認鈕
    confirmButtonText: '<i class="bi bi-check2-circle me-1"></i>是的，確認領回',
    cancelButtonText: '取消'
  });

  if (isConfirmed) {
    // 顯示處理中動畫
    Swal.fire({
      title: '處理結案中...',
      allowOutsideClick: false,
      didOpen: () => { Swal.showLoading(); }
    });

    const payload = {
      signId: signId,
      returnerId: transId, // 抓取目前登入的傳送員編
      returnerName: transName // 抓取目前登入的傳送姓名
    };

    // 呼叫 API 總機進行結案
    const res = await callGAS('acknowledgeReturn', payload);

    if (res.success) {
      Swal.fire({ icon: 'success', title: '已成功領回並結案', timer: 1500, showConfirmButton: false });
      loadTodayDocs(); // 自動重整畫面，讓卡片消失
    } else {
      Swal.fire('發生錯誤', res.message || '領回失敗，請稍後再試', 'error');
    }
  }
}
