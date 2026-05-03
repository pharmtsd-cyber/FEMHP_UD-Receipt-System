// js/pharmacist.js

let currentPharmaId = sessionStorage.getItem('pharmaId');
let currentPharmaName = sessionStorage.getItem('pharmaName');
let replyOptionsData = []; 

document.addEventListener('DOMContentLoaded', async () => {
  if (!currentPharmaId || !currentPharmaName) {
    window.location.href = 'pharmacist_login.html';
    return;
  }
  document.getElementById('displayPharma').textContent = `${currentPharmaName} 藥師`;
  
  const optResult = await callGAS('getPharmaReplyOptions', {});
  if (optResult.success) replyOptionsData = optResult.data;
  
  refreshPharmaDocs();
});

// === 渲染藥師緊湊版介面 ===
async function refreshPharmaDocs() {
  const pendingBox = document.getElementById('pendingContainer');
  const completedBox = document.getElementById('completedContainer');
  const countBadge = document.getElementById('pendingDocCount');

  pendingBox.innerHTML = '<div class="text-center py-3">讀取中...</div>';
  completedBox.innerHTML = '<div class="text-center py-3">讀取中...</div>';

  const result = await callGAS('getPharmaDocRecords', {});

  if (result.success) {
    // === 左側：待收單 ===
    const pendingData = result.data.pending;
    countBadge.textContent = pendingData.length; 
    
    if (pendingData.length === 0) {
      pendingBox.innerHTML = '<div class="text-muted text-center py-4">無待處理單據</div>';
    } else {
      pendingBox.innerHTML = '';
      pendingData.forEach(item => {
        const card = document.createElement('div');
        card.className = 'card mb-2 shadow-sm border-warning border-start border-4';
        card.innerHTML = `
          <div class="card-body p-2">
            <!-- 拿掉右上角時間，只留標題 -->
            <div class="mb-1">
              <strong class="text-dark fs-5">${item.type}</strong>
            </div>
            
            <div class="fs-6 mb-2">
              ${item.detailsHtml}
              <button class="btn btn-sm btn-link py-0 px-1 text-secondary ms-1" onclick="editDocInfo('${item.signId}', '${item.ward}', '${item.chartNo}')"><i class="bi bi-pencil-square"></i> 修改</button>
            </div>
            ${item.sendNote ? `<div class="text-danger small mb-2 bg-light p-1 rounded"><i class="bi bi-exclamation-triangle-fill me-1"></i>送件備註: ${item.sendNote}</div>` : ''}
            
            <!-- ★ 左側卡片：經手人與時間區塊 -->
            <div class="d-flex justify-content-between align-items-center mt-2 border-top pt-2">
              <div class="small text-muted">
                <i class="bi bi-person-walking"></i> 送件人: <strong class="text-dark">${item.senderName}</strong>
                <span class="ms-2">送件時間: <strong>${item.sendTime}</strong></span>
              </div>
              <button class="btn btn-warning btn-sm fw-bold" onclick="receiveDoc('${item.signId}')">進行收單</button>
            </div>
          </div>
        `;
        pendingBox.appendChild(card);
      });
    }

    // === 右側：已收單 ===
    const completedData = result.data.completed;
    if (completedData.length === 0) {
      completedBox.innerHTML = '<div class="text-muted text-center py-4">無收單紀錄</div>';
    } else {
      completedBox.innerHTML = '';
      completedData.forEach(item => {
        
        let badgeClass = 'bg-danger'; 
        let borderClass = 'border-primary';
        
        if (item.replyOption === '收下不歸還') {
          badgeClass = 'bg-success'; 
          borderClass = 'border-success';
        } else if (item.replyOption === '已領回') {
          badgeClass = 'bg-secondary'; 
          borderClass = 'border-secondary';
        }

        const card = document.createElement('div');
        card.className = `card mb-2 shadow-sm border-start border-4 ${borderClass}`;
        card.innerHTML = `
          <div class="card-body p-2">
            <!-- 拿掉右上角時間，只留標題 -->
            <div class="mb-1">
              <strong class="text-primary fs-5">${item.type}</strong>
            </div>
            
            <div class="small text-secondary mb-1">
              ${item.detailsHtml}
            </div>
            
            ${(item.sendNote || item.receiveNote) ? `
            <div class="bg-light p-2 my-2 rounded border small">
              ${item.sendNote ? `<div class="text-danger mb-1"><i class="bi bi-person-walking me-1"></i>傳送備註: <span class="fw-bold">${item.sendNote}</span></div>` : ''}
              ${item.receiveNote ? `<div class="text-primary"><i class="bi bi-capsule me-1"></i>藥師備註: <span class="fw-bold">${item.receiveNote}</span></div>` : ''}
            </div>` : ''}

            <!-- ★ 右側卡片：所有經手人與時間清單 -->
            <div class="d-flex justify-content-between align-items-end mt-2 border-top pt-2">
              <div class="small text-muted">
                <div class="mb-1">
                  <i class="bi bi-person-walking me-1"></i>送件人: <strong class="text-dark">${item.senderName}</strong>
                  <span class="ms-2">送件時間: <strong>${item.sendTime}</strong></span>
                </div>
                <div class="mb-1">
                  <i class="bi bi-capsule me-1"></i>收單人: <strong class="text-primary">${item.pharmaName}</strong>
                  <span class="ms-2">收單時間: <strong>${item.receiveTime}</strong></span>
                </div>
                ${item.returnerName && item.returnerName !== '系統結案' && item.replyOption === '已領回' 
                  ? `<div>
                      <i class="bi bi-check2-circle me-1"></i>領回人: <strong class="text-success">${item.returnerName}</strong>
                      <span class="ms-2">領回時間: <strong>${item.returnTime}</strong></span>
                     </div>` 
                  : ''}
              </div>
              <div class="text-end">
                <span class="badge ${badgeClass} mb-2 d-block fs-6">${item.replyOption}</span>
                <button class="btn btn-outline-danger btn-sm py-0 w-100" onclick="revertDoc('${item.signId}')">撤銷</button>
              </div>
            </div>
          </div>
        `;
        completedBox.appendChild(card);
      });
    }
  }
}

// === 藥師修改傳送填錯的資料 ===
async function editDocInfo(signId, currentWard, currentChartNo) {
  const { value: formValues } = await Swal.fire({
    title: '修改資料',
    html: `
      <input id="swal-ward" class="form-control mb-2" value="${currentWard === 'undefined' ? '' : currentWard}" placeholder="病房床號">
      <input id="swal-chart" class="form-control" value="${currentChartNo === 'undefined' ? '' : currentChartNo}" placeholder="病歷號">
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: '儲存',
    preConfirm: () => {
      return {
        ward: document.getElementById('swal-ward').value.trim(),
        chartNo: document.getElementById('swal-chart').value.trim()
      }
    }
  });

  if (formValues) {
    Swal.fire({ title: '儲存中...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    const payload = { action: 'updateInfo', signId: signId, ward: formValues.ward, chartNo: formValues.chartNo };
    const res = await callGAS('editDocRecord', { payload: payload });
    if (res.success) {
      Swal.fire({ icon: 'success', title: '修改成功', timer: 1000, showConfirmButton: false }); // ★ 蓋掉轉圈圈
      refreshPharmaDocs();
    } else {
      Swal.fire('失敗', res.message, 'error');
    }
  }
}

// === 藥師撤銷收單 ===
async function revertDoc(signId) {
  const confirm = await Swal.fire({
    title: '確定要撤銷嗎？',
    text: "撤銷後，該筆單據會回到左側的「待收單」列表，且傳送人員的紀錄也會恢復未結案狀態。",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#dc3545',
    confirmButtonText: '是的，撤銷'
  });

  if (confirm.isConfirmed) {
    Swal.fire({ title: '撤銷中...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    const payload = { action: 'revertReceive', signId: signId };
    const res = await callGAS('editDocRecord', { payload: payload });
    if (res.success) {
      Swal.fire({ icon: 'success', title: '已撤銷', timer: 1000, showConfirmButton: false }); // ★ 蓋掉轉圈圈
      refreshPharmaDocs();
    } else {
      Swal.fire('失敗', res.message, 'error');
    }
  }
}

// === 確認收單 (保留下拉選單) ===
async function receiveDoc(signId) {
  let optionsHtml = replyOptionsData.map(opt => `<option value="${opt}">${opt}</option>`).join('');
  const { value: formValues, isConfirmed } = await Swal.fire({
    title: '處理收件單',
    html: `
      <div class="mb-3 text-start">
        <label class="form-label fw-bold">處置方式 <span class="text-danger">*</span></label>
        <select id="swal-reply-opt" class="form-select">${optionsHtml}</select>
      </div>
      <div class="text-start">
        <label class="form-label fw-bold">備註 (選填)</label>
        <input id="swal-note" class="form-control" placeholder="給傳送的備註...">
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: '確定',
    preConfirm: () => {
      const replyOpt = document.getElementById('swal-reply-opt').value;
      if (!replyOpt) { Swal.showValidationMessage('請選擇處置方式！'); return false; }
      return { replyOption: replyOpt, note: document.getElementById('swal-note').value.trim() }
    }
  });

  if (isConfirmed && formValues) {
    Swal.fire({ title: '處理中...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    const payload = { signId, pharmaId: currentPharmaId, pharmaName: currentPharmaName, replyOption: formValues.replyOption, note: formValues.note };
    const res = await callGAS('receiveDocTransfer', { payload: payload });
    if (res.success) {
      Swal.fire({ icon: 'success', title: '收單成功', timer: 1000, showConfirmButton: false }); // ★ 蓋掉轉圈圈
      refreshPharmaDocs();
    } else {
      Swal.fire('失敗', res.message, 'error');
    }
  }
}

document.getElementById('btnRefreshPending').addEventListener('click', refreshPharmaDocs);
function logout() { sessionStorage.removeItem('pharmaId'); sessionStorage.removeItem('pharmaName'); window.location.href = 'index.html'; }
