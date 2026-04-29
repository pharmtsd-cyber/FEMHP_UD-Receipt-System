// js/config.js
// 請將下方字串替換為您 GAS 部署為網頁應用程式後的 URL
const GAS_API_URL = "https://script.google.com/macros/s/AKfycbzW-FXXIYAWWTaMyD5ppmt732aqzVqpsDCemhfLetHB3ja08zQZqhA2PD-zYLgEfjym/exec";

// 封裝與 GAS 溝通的共用函數
async function callGAS(action, dataObj) {
  const payload = { action: action, ...dataObj };
  
  try {
    // ⚠️ 關鍵：發送至 GAS 時，不要設定 Content-Type: application/json
    // 否則會觸發瀏覽器的 CORS Preflight (OPTIONS 請求)，導致 GAS 報錯。
    // 使用預設的 text/plain 傳送 JSON 字串即可完美避開 CORS 問題。
    const response = await fetch(GAS_API_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return await response.json();
  } catch (error) {
    console.error("API 請求錯誤:", error);
    Swal.fire('連線錯誤', '無法連線至資料庫，請確認網路狀態', 'error');
    return { success: false };
  }
}
