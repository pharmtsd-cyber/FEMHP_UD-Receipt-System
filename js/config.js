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

async function callGAS(action, dataObj = {}) {
  // ★ 核心優化：智慧分流。如果 action 在 READ_ACTIONS 名單內，就送往 READ 網址；否則送往 WRITE 網址。
  const targetUrl = READ_ACTIONS.includes(action) ? API_URL_READ : API_URL_WRITE;
  
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

    // 處理 503 流量管制 (從上一次優化保留)
    if (!response.ok) {
      if (response.status === 503 || response.status === 502) {
        Swal.fire({
          icon: 'warning',
          title: '伺服器連線異常',
          text: `目前伺服器無回應 (${response.status})，請稍等幾秒後再重試。`,
          confirmButtonColor: '#2C5343'
        });
        return { success: false, message: `伺服器連線異常 (${response.status})` };
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const result = await response.json();
    return result;

  } catch (error) {
    console.error(`[${action}] API 請求錯誤:`, error);
    if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
      Swal.fire({
        icon: 'error',
        title: '網路連線異常',
        html: `系統無法連接至後端伺服器。<br>請確認網路連線。`,
        confirmButtonColor: '#2C5343'
      });
    } else {
      Swal.fire('系統錯誤', '發生未知的連線問題，請稍後再試。', 'error');
    }
    return { success: false, message: '網路連線異常' };
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
