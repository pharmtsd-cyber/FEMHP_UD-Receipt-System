// ==========================================
// 音效模組 (保持不變)
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
// 主邏輯控制塊
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  // 1. 權限檢查 (統一檢查 sessionStorage)
  const transId = sessionStorage.getItem('transId');
  const transName = sessionStorage.getItem('transName');

  if (!transId || !transName) {
    Swal.fire('未授權', '請先登入', 'warning').then(() => {
      window.location.href = 'transport_login.html'; //
    });
    return;
  }

  // 顯示當前登入者
  document.getElementById('displayUser').textContent = `${transName} (${transId})`;

  // 設定今日日期
  const today = new Date().toISOString().split('T')[0];
  const medDateInput = document.getElementById('medDate');
  if(medDateInput) medDateInput.value = today;

  // 2. 初始化選單 (自動執行第三層 action: getConfigData)
  if(document.getElementById('docTypeSelect')) {
    await loadDocConfig();
  }

  // 3. 條碼輸入邏輯
  const barcodeInput = document.getElementById('barcodeInput');
  const cardContainer = document.getElementById('cardContainer');
  const totalCountSpan = document.getElementById('totalCount');
  const scannedItems = new Set();
  
  if(barcodeInput) {
    barcodeInput.focus();
    
    // 全域點擊自動聚焦輸入框
    document.body.addEventListener('click', (e) => {
      if (e.target.tagName !== 'BUTTON' && !e.target.classList.contains('nav-link')) {
         barcodeInput.focus();
      }
    });

    barcodeInput.addEventListener('keypress', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const barcodeValue = barcodeInput.value.trim();
        if (!barcodeValue) return;

        // 條碼解析
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
        const isNewItem = !scannedItems.has(itemKey);
        const cardId = 'card_' + Date.now();

        // 建立待命卡片
        const dataForCard = {
          chartNo, dispenseNo, rxDate, staffName: transName, type: '傳送'
        };
        
        if (isNewItem) {
          scannedItems.add(itemKey);
          addCardToUI(dataForCard, cardId, true); 
          if(totalCountSpan) totalCountSpan.textContent = scannedItems.size;
        } else {
          addCardToUI(dataForCard, cardId, true, true); 
        }
        
        barcodeInput.value = '';

        // 【核心修正】：發送到 Switch 的案例 1 (logDischargeMeds)
        // 我們直接傳送物件，config.js 會幫我們包裝好 payload
        const result = await callGAS('logDischargeMeds', {
          date: document.getElementById('medDate').value,
          barcode: barcodeValue,
          type: '傳送',
          staffId: transId,
          staffName: transName,
          chartNo: chartNo,
          dispenseNo: dispenseNo,
          rxDate: rxDate
        });
        
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
});

// ==========================================
// 輔助函數：渲染卡片 (保持不變)
// ==========================================
function addCardToUI(data, cardId, isPending, isDuplicate = false) {
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
        <h3 class="m-0 text-success fw-bold">領藥號：${data.dispenseNo} ${isDuplicate ? '<span class="badge bg-warning text-dark fs-6 ms-2">重複刷入</span>' : ''}</h3>
        <span class="text-muted fs-4">${timeString}</span>
      </div>
      <div class="row">
        <div class="col-12 fs-5 text-secondary">病歷號：<span class="fw-bold text-dark">${data.chartNo}</span> | 處方日期：${data.rxDate}</div>
      </div>
    </div>`;
  container.insertBefore(card, container.firstChild);
}

// ==========================================
// 輔助函數：取得選單 (Switch 案例 3)[cite: 1]
// ==========================================
// 1. 宣告全域變數，用來記住所有文件類型的欄位設定
let globalDocConfigs = [];

// 2. 覆寫原本的 loadDocConfig
async function loadDocConfig() {
  const select = document.getElementById('docTypeSelect');
  if(!select) return;
  select.innerHTML = '<option value="">資料載入中...</option>';

  try {
    const response = await callGAS('getConfigData'); 
    if (response.success && response.data) {
      globalDocConfigs = response.data; // ★ 把後端攤平的 JSON 存起來

      select.innerHTML = '<option value="">請選擇類型...</option>';
      response.data.forEach(item => {
          const opt = document.createElement('option');
          // 以「送件類型名稱」或「Title」作為選項值
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

// 3. 監聽下拉選單切換，動態渲染欄位
document.addEventListener('DOMContentLoaded', () => {
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

      // 從剛剛存起來的變數中，找到使用者選的那個設定檔
      const config = globalDocConfigs.find(c => (c['送件類型名稱'] || c.Title) === selectedType);
      if (!config) return;

      let html = '';
      // 這些是系統用的屬性，不需要變成輸入框
      const excludeKeys = ['Title', '送件類型名稱'];

      // 掃描 JSON 裡面的每一個屬性 (例如：病房床號、病歷號)
      Object.keys(config).forEach(key => {
        if (!excludeKeys.includes(key)) {
          const requirement = config[key]; // 會得到 "必填", "選填", "隱藏"

          if (requirement !== '隱藏') {
            const isRequired = requirement === '必填' ? 'required' : '';
            const star = requirement === '必填' ? '<span class="text-danger">*</span>' : '<span class="text-muted fs-6">(選填)</span>';

            // ★ 加上 data-key，方便我們送出表單時抓取資料
            html += `
              <div class="mb-3 text-start">
                <label class="form-label fw-bold fs-5">${key} ${star}</label>
                <input type="text" class="form-control form-control-lg dynamic-input" data-key="${key}" placeholder="請輸入${key}" ${isRequired}>
              </div>
            `;
          }
        }
      });

      // 如果完全沒有設定欄位，或是都設為隱藏
      if (html === '') {
        html = '<div class="text-success text-center py-3 fw-bold"><i class="bi bi-check-circle me-2"></i>此文件不需填寫額外資料，請直接送出</div>';
      }

      container.innerHTML = html;
    });
  }
});

// 4. 攔截表單送出，將資料打包給 API 總機
document.addEventListener('DOMContentLoaded', () => {
  const docForm = document.getElementById('docForm');
  if (docForm) {
    docForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      // ★ 利用剛剛埋好的 data-key，精準抓出畫面上輸入的值
      const wardInput = document.querySelector('input[data-key="病房床號"]');
      const chartInput = document.querySelector('input[data-key="病歷號"]');

      const payload = {
        type: document.getElementById('docTypeSelect').value,
        ward: wardInput ? wardInput.value.trim() : '',
        chartNo: chartInput ? chartInput.value.trim() : '',
        sendNote: document.getElementById('docNote').value.trim(),
        senderName: sessionStorage.getItem('transName')
      };

      const btn = document.getElementById('btnSubmitDoc');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>傳送中...';

      // 呼叫 API 總機：寫入 SharePoint
      const res = await callGAS('submitDocTransfer', payload);

      if (res.success) {
        Swal.fire({ icon: 'success', title: '送件成功', text: `系統單號: ${res.signId}`, timer: 2000 });
        docForm.reset();
        document.getElementById('dynamicFieldsContainer').innerHTML = '<div class="text-muted text-center py-4 fs-5">請先選擇送件類型</div>';
        
        // ★ 加上這一行，送出後自動刷新右邊的卡片列表！
        loadTodayDocs(); 
        
      } else {
        Swal.fire('失敗', res.message, 'error');
      }

      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-send-fill me-2"></i>確認送出';
    });
  }
});

// 5. 獲取並渲染今日送件進度 (卡片產生器)
async function loadTodayDocs() {
  const container = document.getElementById('docRecordContainer');
  const btn = document.getElementById('btnRefreshDoc');
  if (!container) return;

  // 讓按鈕轉圈圈，避免重複點擊
  if(btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>讀取中';
  }
  container.innerHTML = '<div class="text-muted text-center py-5 fs-5">資料讀取中...</div>';

  // 呼叫剛剛在 Power Automate 寫好的 API
  const res = await callGAS('getTodayDocRecords');

  if (res.success) {
    if (res.data.length === 0) {
      container.innerHTML = '<div class="text-muted text-center py-5 fs-5">今日尚無未結案的送件紀錄</div>';
    } else {
      // 將資料陣列轉換成精美的卡片 HTML
      container.innerHTML = res.data.map(item => `
        <div class="card mb-3 shadow-sm border-start border-4 ${item.status === '待藥師收單' ? 'border-warning' : (item.status === '退件' ? 'border-danger' : 'border-primary')}">
          <div class="card-body p-3">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <span class="badge ${item.status === '待藥師收單' ? 'bg-warning text-dark' : (item.status === '退件' ? 'bg-danger' : 'bg-primary')} fs-6">${item.status}</span>
              <span class="text-muted small">${item.sendTime}</span>
            </div>
            <h5 class="fw-bold text-dark mb-1">${item.type}</h5>
            <div class="text-secondary small mb-2">
              病房床號: <span class="fw-bold">${item.ward || '-'}</span> | 病歷號: <span class="fw-bold">${item.chartNo || '-'}</span>
            </div>
            <div class="d-flex justify-content-between align-items-end mt-2 pt-2 border-top">
              <div class="small text-muted">
                <i class="bi bi-person-walking"></i> 送件: ${item.sender}<br>
                <i class="bi bi-capsule"></i> 藥師: <span class="${item.pharmaName === '等待中' ? 'text-danger' : 'text-primary'}">${item.pharmaName}</span>
              </div>
              ${(item.status === '掛牌待傳送領回' || item.status === '退件') ? `<button class="btn btn-sm btn-outline-success fw-bold" onclick="acknowledgeReturn('${item.signId}')">確認領回</button>` : ''}
            </div>
          </div>
        </div>
      `).join('');
    }
  } else {
    container.innerHTML = '<div class="text-danger text-center py-5 fs-5">讀取失敗，請確認網路連線</div>';
  }

  // 恢復按鈕狀態
  if(btn) {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-arrow-clockwise me-1"></i>重整';
  }
}

// 6. 綁定「重整按鈕」與「頁籤切換」事件
document.addEventListener('DOMContentLoaded', () => {
  // 綁定重整按鈕
  const btnRefreshDoc = document.getElementById('btnRefreshDoc');
  if (btnRefreshDoc) {
    btnRefreshDoc.addEventListener('click', loadTodayDocs);
  }
  
  // 當點擊「送文件給藥局」這個頁籤時，自動載入最新資料
  const docTab = document.getElementById('doc-tab');
  if (docTab) {
    docTab.addEventListener('shown.bs.tab', loadTodayDocs);
  }
});

function logout() {
  sessionStorage.clear();
  window.location.href = 'index.html';
}
