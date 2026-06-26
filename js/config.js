// === 系統共用設定檔 (config.js) ===

// 1. 原本的總機 (負責寫入/修改/登入/狀態更新)
const API_URL_WRITE = "https://defaultf611cf53b6864814b03558908d4900.be.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/2309b831793f4f4fa7cf3f2a7e72ab4a/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=rqleQ5OYOGNFAk5ozBhVjE8Sxs_Pufr6aQ3DDI-ONV4";

// 2. 新增的查詢專機 (負責純讀取資料) -> 請填入你新建流程的 URL
const API_URL_READ = "https://defaultf611cf53b6864814b03558908d4900.be.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/81f4781d6d1c4b96b98e81b91259049c/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=2IkOg3OCv_cwrTQvPYaK42seYgN0ZSs0QhBtFN8N1eA";

// 3. 定義哪些動作屬於「純讀取」
const READ_ACTIONS = [
  'getConfigData',
  'getTodayDocRecords',
  'getPharmaReplyOptions',
  'getPharmaDocRecords',
  'getDailyRecords',
  'getPublicDocRecords',
  'getStaffList'
];

async function callGAS(action, dataObj = {}, retries = 3) {
  // 自動判斷要打去哪個網址 (若尚未設定 READ_ACTIONS，可忽略或直接用 API_URL)
  const targetUrl = (typeof READ_ACTIONS !== 'undefined' && READ_ACTIONS.includes(action)) 
                    ? API_URL_READ : API_URL_WRITE;
  
  // 處理特殊符號，防止中斷
  const sanitizedObj = {};
  for (let key in dataObj) {
    sanitizedObj[key] = typeof dataObj[key] === 'string' ? encodeURIComponent(dataObj[key]) : dataObj[key];
  }

  const payload = { action: action, payload: sanitizedObj };
  
  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload) 
    });

    if (!response.ok) {
      // ★ 核心優化：遇到 502 或 503 塞車時，啟動「無感自動重試」
      if ((response.status === 503 || response.status === 502) && retries > 0) {
        console.warn(`[${action}] 遭遇 ${response.status} 塞車，準備自動重試... (剩餘次數: ${retries})`);
        
        // 如果畫面上已經有 SweetAlert 的載入遮罩，更新文字安撫人員
        if (Swal.isVisible()) {
          Swal.update({ title: '線路稍忙，系統自動重試中...' });
        }

        // 暫停 2 秒 (2000 毫秒) 讓伺服器喘息
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 呼叫自己進行重試，並將剩餘次數減 1
        return await callGAS(action, dataObj, retries - 1);
      }
      
      // 如果重試 3 次都失敗，或是遇到其他的致命錯誤，才會拋出 Error
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();

  } catch (error) {
    console.error(`[${action}] API 請求錯誤:`, error);
    
    // 只有在重試耗盡，或真的完全斷網時，才彈出失敗視窗
    if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
      Swal.fire({
        icon: 'error',
        title: '網路連線異常',
        html: `系統無法連接至雲端。<br>請確認網路連線是否正常。`,
        confirmButtonColor: '#2C5343'
      });
    } else {
      Swal.fire('系統錯誤', '伺服器持續忙碌，請稍後重試。', 'error');
    }
    return { success: false, message: '連線或伺服器異常' };
  }
}

// 4. 全局共用的 Toast
const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 2000,
  timerProgressBar: true,
  didOpen: (toast) => {
    toast.addEventListener('mouseenter', Swal.stopTimer)
    toast.addEventListener('mouseleave', Swal.resumeTimer)
  }
});
