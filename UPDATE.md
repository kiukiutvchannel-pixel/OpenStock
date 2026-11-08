# 穩步：富途日線改走程序 TCP 11111

呢個係**上一包（WebSocket）之後**嘅更新，唔係成個專案。請蓋去：

`C:\Users\comfy\Desktop\openstock-paper\openstock-paper`

上一包叫你開 WebSocket、填端口 33333。你部新版 FutuOpenD 冇呢個選項，所以今次改走官方文件寫明嘅**程序 TCP**。報價仍然用 Finnhub。讀唔到日線就唔會落單，亦唔會再用假歷史。呢個程式**只讀歷史 K 線**，唔會解鎖交易，亦唔會落單。

官方文件（openapi.futunn.com，v10.12）入面，歷史 K 線係協議 **3103**，連 **API 端口，預設 11111**。同一份文件嘅 **22222** 係 Telnet 操作命令例子，唔係歷史 K 線。畫面寫住「HTTP (WebAPI) 22222」，但文件冇列出 HTTP 歷史 K 線嘅網址、登入方式或者代碼格式，所以唔會估一條 HTTP 路徑。

呢份說明係 UTF-8（有 BOM）。PowerShell 5.1 如果亂碼：

```powershell
Get-Content -Encoding UTF8 .\UPDATE.md
```

---

## 1. 停伺服器

去緊跑緊開發伺服器嗰個視窗，按 `Ctrl+C`，等到返到提示字元。

## 2. 備份

```powershell
$dst = "C:\Users\comfy\Desktop\openstock-paper\openstock-paper"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
Copy-Item -LiteralPath $dst -Destination ($dst + "-backup-" + $stamp) -Recurse -Force
```

備份入面有 `.env`。唔好上傳。

## 3. 解壓同複製（唔好覆蓋 .env）

假設壓縮檔喺桌面，檔名 `openstock-futu-tcp-update.zip`：

```powershell
$zip = "C:\Users\comfy\Desktop\openstock-futu-tcp-update.zip"
$src = "C:\Users\comfy\Desktop\openstock-futu-tcp-update"
$dst = "C:\Users\comfy\Desktop\openstock-paper\openstock-paper"
if (Test-Path -LiteralPath $src) { Remove-Item -LiteralPath $src -Recurse -Force }
Expand-Archive -LiteralPath $zip -DestinationPath $src
Get-ChildItem -LiteralPath $src -Recurse -File | ForEach-Object {
  if ($_.Name -eq ".env") { return }
  $rel = $_.FullName.Substring((Resolve-Path -LiteralPath $src).Path.Length).TrimStart("\")
  $target = Join-Path $dst $rel
  $folder = Split-Path -Parent $target
  if (-not (Test-Path -LiteralPath $folder)) { New-Item -ItemType Directory -Force -Path $folder | Out-Null }
  Copy-Item -LiteralPath $_.FullName -Destination $target -Force
}
```

確認 `.env` 仲喺度（應顯示 `True`）：

```powershell
Test-Path -LiteralPath "C:\Users\comfy\Desktop\openstock-paper\openstock-paper\.env"
```

## 4. 刪走舊檔（如果仲喺度）

```powershell
Set-Location -LiteralPath "C:\Users\comfy\Desktop\openstock-paper\openstock-paper"
if (Test-Path -LiteralPath ".\public\favicon.ico") { Remove-Item -LiteralPath ".\public\favicon.ico" -Force }
if (Test-Path -LiteralPath ".\types\futu-api.d.ts") { Remove-Item -LiteralPath ".\types\futu-api.d.ts" -Force }
```

`public\favicon.ico` 會同 `app\favicon.ico` 相撞。`types\futu-api.d.ts` 係上一包 WebSocket 套件用，今次已經唔使。

## 5. 開 FutuOpenD 嘅程序 (TCP)

1. 打開 **FutuOpenD**，登入。只要行情。唔使解鎖交易密碼。
2. 開放連結方式入面，勾 **程序 (TCP)**。預設端口 **11111**。
3. **唔好**靠「HTTP (WebAPI) 22222」嚟讀日線。官方 v10.12 冇 HTTP 歷史 K 線。22222 喺文件係 Telnet。
4. 你部 OpenD 冇 WebSocket 選項，唔使再搵。如果 `.env` 仲有 `FUTU_OPEND_KEY` 或者端口 `33333`，下面會改走。

OpenD 要保持開住，個程式先讀到日線。如果開咗 RSA 加密，今次客戶端讀唔到，會當連唔上，唔會用假日線。

## 6. 用手改 .env（唔好成份覆蓋）

用記事本開 `C:\Users\comfy\Desktop\openstock-paper\openstock-paper\.env`。

**留低**你原有嘅 `MONGODB_URI`、`BETTER_AUTH_SECRET`、`FINNHUB_API_KEY`。Finnhub 仍然負責報價。

如果已經有上一包加嘅 `HISTORY_PROVIDER`、`FUTU_OPEND_HOST`、`FUTU_OPEND_PORT`、`FUTU_OPEND_KEY`，改成下面三行，並刪走 `FUTU_OPEND_KEY`。未有就加喺檔案尾：

```env
HISTORY_PROVIDER=futu
FUTU_OPEND_HOST=127.0.0.1
FUTU_OPEND_PORT=11111
```

`FUTU_OPEND_PORT` 一定要係第 5 步個 **程序 (TCP)** 端口。填 22222 係 Telnet，讀唔到日線。

## 7. 重裝依賴同再開

今次拆走咗 `futu-api`，要跟 lock 檔重裝。

```powershell
Set-Location -LiteralPath "C:\Users\comfy\Desktop\openstock-paper\openstock-paper"
npm.cmd ci
npm.cmd run dev -- --hostname 127.0.0.1
```

瀏覽器開 http://localhost:3000 ，入模擬交易，撳「立即分析」。

- 成功嘅話，歷史來源會寫 **富途 OpenD**。報價來源仍然係 Finnhub。
- 如果寫「連不上富途 OpenD」，檢查 OpenD 開咗未、有冇勾「程序 (TCP)」、`.env` 係咪 **11111**。畫面嘅 HTTP WebAPI 22222 唔係呢條日線。
- 如果寫「行情權限」或者「額度已用完」，就係富途帳戶限制，唔會改用假日線落單。

呢次測試冇連你部機嘅 OpenD，亦冇改你嘅 `.env`。唔代表策略會賺錢。

## 檔案清單

今次 ZIP 只係上一包之後改過嘅檔。唔包含 `.env`。`types\futu-api.d.ts` 係刪走，ZIP 入面冇呢個檔，請跟第 4 步自己刪。

- `.env.example`
- `MANIFEST.txt`
- `UPDATE.md`
- `__tests__/futu-history.test.ts`
- `lib/paper-trading/futu-history.ts`
- `lib/paper-trading/messages.ts`
- `next.config.ts`
- `package-lock.json`
- `package.json`
