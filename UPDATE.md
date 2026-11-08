# 模擬交易安全更新同繁體中文介面

這是一份**只含改過的檔案**的更新包，用來蓋在你已經裝好的資料夾上面：

`C:\Users\comfy\Desktop\openstock-paper\openstock-paper`

它**不是**全新安裝，也**不是**一鍵安裝程式。請先備份，再複製。不要覆蓋 `.env`，不要清掉 MongoDB Atlas 裡面的帳號、自選股或模擬交易紀錄。

原專案是 Open-Dev-Society 的 OpenStock，授權 **AGPL-3.0**（見 `LICENSE`）。模擬交易是在這個授權上加的本地修改，說明見 `PAPER-TRADING-NOTICE.md`。

這份說明用 UTF-8（帶 BOM）儲存，方便 Windows PowerShell 5.1 顯示中文。如果畫面仍然亂碼，請用記事本或 VS Code 開啟，或在 PowerShell 輸入：

```powershell
Get-Content -Encoding UTF8 .\UPDATE.md
```

---

## 這次改了什麼

### 模擬交易安全（只限模擬，不會連真券商）

- 日線缺失、被拒絕（401/403）、速率限制（429）、逾時或網絡錯誤時，**不會再偷偷用假歷史**去計算買賣。
- 報價同歷史分開標示。真實報價不能掩蓋虛構或缺失的日線。
- 要有至少 **21 根**、按日期排列、而且是紐約交易所交易日的收市價，先可以判斷 SMA(10) 同 SMA(20) 的交叉。最新一根必須是最近一個**已收市**的交易日（週末同假期不會被當成「今日沒有數據所以過期」）。
- 分析師評級只是文字說明。**沒有新的均線交叉，就不會因此變成買入或賣出，也不會落單。**
- 不再顯示未經校準的勝率百分比（例如舊的 55% 或 75%）。舊紀錄就算存過一個分數，畫面上也不當勝率。
- 自動提交**預設關閉**。沒有背景定時自動落單。你要自己在頁面開啟，而且該次分析必須是可執行的交叉，先會落一張模擬單。
- 同一帳戶、代號、策略、方向、同一根 K 線，只會成交一次。重複按「立即分析」或同時按兩次，不會重複成交。
- 預設上限：單一代號持倉市值 **USD 10,000**，全部持倉市值 **USD 40,000**。自動單另外最多用現金的 5%，而且單筆不超過 USD 5,000。可在 `.env` **新增**下面的變數來調整（不要刪掉你現有的 Finnhub 或 Atlas 設定）：

```env
PAPER_MAX_SYMBOL_EXPOSURE_USD=10000
PAPER_MAX_TOTAL_EXPOSURE_USD=40000
PAPER_AUTO_TRADE_FRACTION=0.05
PAPER_AUTO_TRADE_MAX_USD=5000
```

- 只有在 `.env` 寫上 `PAPER_TRADING_DEMO=1` 時才會顯示虛構數字。這個模式**不能落單**。不要為了看到數字而開啟它來做真實判斷。
- 「重設模擬賬簿」仍然會刪掉**這個登入帳號**的模擬持倉、訂單和訊號。這次更新**不會**替你按這個按鈕，也不會重設整個資料庫。

### 繁體中文介面

登入後的選單、分頁、總覽、搜尋、自選股、到價提示、個人檔案、登入／註冊表單，以及模擬交易頁，改為繁體中文（香港常用說法）。金額標明 **USD（美元）**。我們顯示的時間是 **台北時間 UTC+8**。股票代號、OpenStock 名稱、Finnhub、Google、GitHub 這些名稱保持原樣。

以下仍然可能是英文，因為我們控制不了，或是不應改寫的原文：

- TradingView 嵌入圖裡的新聞標題、部分指標名稱（RSI、MACD、VWAP、ATR）和公司英文介紹。圖表已盡量設成繁體（`zh_TW`），時間軸設為 `Asia/Taipei`。
- 行銷頁（關於、說明、首頁）和上方「新版本」橫額。
- 登入頁側邊的創辦人英文引言。
- 國家清單裡大部分國名（香港、澳門、台灣、中國已改成中文）。
- 歡迎信和電郵範本。

---

## 安裝前必讀

1. 這次測試是在另一部電腦做的單元測試、型別檢查同編譯。**沒有連上你的 Atlas，沒有讀你的 `.env`，也沒有在你的 Windows 上跑過。** 不能說你部電腦已經修好。
2. 這個策略**不保證賺錢**。模擬成交不計滑價、手續費同流動性。
3. 依賴套件的安全審計仍然是 **25 項**（10 中、14 高、1 嚴重）。嚴重項目是建置工具 `@tailwindcss/oxide` 帶入的 `tar`（解壓縮），不是模擬交易程式本身。這次**沒有**強制升級，以免弄壞現有安裝。請只在自己的電腦用 `http://localhost:3000`，不要把這個程式暴露到公網。

---

## Windows 步驟（PowerShell 5.1）

先完全停掉正在跑的開發伺服器：在那個視窗按 `Ctrl+C`，等到回到提示字元。

### 1. 備份整個資料夾

```powershell
$dst = "C:\Users\comfy\Desktop\openstock-paper\openstock-paper"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
Copy-Item -LiteralPath $dst -Destination ($dst + "-backup-" + $stamp) -Recurse -Force
```

備份裡含有你的 `.env`。不要把備份上傳或寄給別人。

### 2. 解壓更新包

假設壓縮檔在桌面，檔名 `openstock-paper-zh-safety-update.zip`：

```powershell
$zip = "C:\Users\comfy\Desktop\openstock-paper-zh-safety-update.zip"
$src = "C:\Users\comfy\Desktop\openstock-paper-update"
if (Test-Path -LiteralPath $src) { Remove-Item -LiteralPath $src -Recurse -Force }
Expand-Archive -LiteralPath $zip -DestinationPath $src
```

### 3. 只複製更新檔，保留 `.env` 和資料

下面的指令**不會**複製名為 `.env` 的檔。它會覆蓋列出的程式檔。它不會刪除 Atlas 資料，也不會叫你重設模擬賬簿。

```powershell
$src = "C:\Users\comfy\Desktop\openstock-paper-update"
$dst = "C:\Users\comfy\Desktop\openstock-paper\openstock-paper"
Get-ChildItem -LiteralPath $src -Recurse -File | ForEach-Object {
  $rel = $_.FullName.Substring((Resolve-Path -LiteralPath $src).Path.Length).TrimStart('\')
  if ($_.Name -eq '.env') { return }
  $target = Join-Path $dst $rel
  $folder = Split-Path -Parent $target
  if (-not (Test-Path -LiteralPath $folder)) { New-Item -ItemType Directory -Force -Path $folder | Out-Null }
  Copy-Item -LiteralPath $_.FullName -Destination $target -Force
}
```

複製完成後，確認這個檔仍然是你原本的，而且沒有被清空：

```powershell
Test-Path -LiteralPath "C:\Users\comfy\Desktop\openstock-paper\openstock-paper\.env"
```

應顯示 `True`。不要用 `.env.example` 覆蓋 `.env`。

### 4. 重新啟動

這次**沒有**改 `package.json` 或 `package-lock.json`。平常**不用**重新 `npm ci`。

```powershell
Set-Location -LiteralPath "C:\Users\comfy\Desktop\openstock-paper\openstock-paper"
npm.cmd run dev
```

如果 `node_modules` 不見了，先安裝再啟動（仍然不要動 `.env`）：

```powershell
npm.cmd ci
npm.cmd run dev
```

瀏覽器打開 http://localhost:3000 ，登入後左邊應看到「總覽」「自選股」「模擬交易」。

自動提交請保持關閉，先看「立即分析」的歷史訊號是不是「不可執行」或「觀望」。只有在日線和報價都通過檢查、而且真的出現交叉時，訊號才會標成可執行。

---

## 檔案清單

完整清單也寫在壓縮包內的 `MANIFEST.txt`。不要把 `.env`、`.git`、`node_modules`、`.next` 放進更新包。

共 62 個檔：

- `app/(auth)/forgot-password/page.tsx`
- `app/(auth)/reset-password/ResetPasswordForm.tsx`
- `app/(auth)/sign-in/page.tsx`
- `app/(auth)/sign-up/page.tsx`
- `app/globals.css`
- `app/layout.tsx`
- `app/(root)/dashboard/page.tsx`
- `app/(root)/paper-trading/page.tsx`
- `app/(root)/profile/page.tsx`
- `app/(root)/stocks/[symbol]/page.tsx`
- `app/(root)/watchlist/page.tsx`
- `components/DataFreshness.tsx`
- `components/forms/CountrySelectField.tsx`
- `components/forms/SocialAuthButtons.tsx`
- `components/landing/ProductPreview.tsx`
- `components/MarketSwitcher.tsx`
- `components/paper-trading/PaperTradingClient.tsx`
- `components/profile/PasswordForm.tsx`
- `components/profile/ProfileForm.tsx`
- `components/SearchCommand.tsx`
- `components/shell/Sidebar.tsx`
- `components/shell/TabBar.tsx`
- `components/stocks/StockChart.tsx`
- `components/stocks/StockHeader.tsx`
- `components/TradingViewWidget.tsx`
- `components/watchlist/AlertsPanel.tsx`
- `components/WatchlistButton.tsx`
- `components/watchlist/CreateAlertModal.tsx`
- `components/watchlist/NewsList.tsx`
- `components/watchlist/WatchlistTable.tsx`
- `database/models/paper-account.model.ts`
- `database/models/paper-idempotency.model.ts`
- `database/models/paper-order.model.ts`
- `database/models/paper-position.model.ts`
- `database/models/strategy-signal.model.ts`
- `.env.example`
- `lib/actions/alert.actions.ts`
- `lib/actions/auth.actions.ts`
- `lib/actions/paper-trading.actions.ts`
- `lib/actions/profile.actions.ts`
- `lib/actions/watchlist.actions.ts`
- `lib/constants.ts`
- `lib/i18n/format.ts`
- `lib/i18n/zh-Hant.ts`
- `lib/paper-trading/calendar.ts`
- `lib/paper-trading/constants.ts`
- `lib/paper-trading/exposure.ts`
- `lib/paper-trading/history.ts`
- `lib/paper-trading/idempotency.ts`
- `lib/paper-trading/labels.ts`
- `lib/paper-trading/messages.ts`
- `lib/paper-trading/quotes.ts`
- `lib/paper-trading/strategy.ts`
- `lib/paper-trading/types.ts`
- `lib/rate-limit.ts`
- `lib/utils.ts`
- `PAPER-TRADING-NOTICE.md`
- `__tests__/alert-actions.test.ts`
- `__tests__/paper-trading-safety.test.ts`
- `__tests__/zh-hant-ui.test.ts`
- `UPDATE.md`
- `MANIFEST.txt`

