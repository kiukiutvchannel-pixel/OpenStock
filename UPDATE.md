﻿# 穩步：用富途 OpenD 讀日線

呢個係**上一包之後**嘅更新，唔係成個專案。請蓋去：

`C:\Users\comfy\Desktop\openstock-paper\openstock-paper`

模擬交易嘅日線改由你部 Windows 上面嘅 **FutuOpenD** 讀。報價仍然用 Finnhub。讀唔到日線就唔會落單，亦唔會再用假歷史。呢個程式**只讀歷史 K 線**，唔會解鎖交易，亦唔會落單。

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

假設壓縮檔喺桌面，檔名 `openstock-futu-history-update.zip`：

```powershell
$zip = "C:\Users\comfy\Desktop\openstock-futu-history-update.zip"
$src = "C:\Users\comfy\Desktop\openstock-futu-update"
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

## 4. 刪走舊 favicon（如果仲喺度）

上一包可能留低 `public\favicon.ico`，會同 `app\favicon.ico` 相撞。

```powershell
Set-Location -LiteralPath "C:\Users\comfy\Desktop\openstock-paper\openstock-paper"
if (Test-Path -LiteralPath ".\public\favicon.ico") { Remove-Item -LiteralPath ".\public\favicon.ico" -Force }
```

## 5. 開 FutuOpenD 嘅 WebSocket

1. 打開 **FutuOpenD**，登入。只要行情。唔使解鎖交易密碼。
2. 設定入面，API 嘅 **11111** 係 TCP 端口。今次用嘅官方 Node 套件 `futu-api` **用唔到 11111**。
3. 喺同一個設定開 **WebSocket**。唔好勾 SSL（本機 `127.0.0.1`）。
4. 記住 WebSocket 端口。官方例子多數係 **33333**。如果你改過，用你自己個端口。
5. 如果畫面有 WebSocket 密鑰，抄低。唔好貼去聊天或者 commit。

OpenD 要保持開住，個程式先讀到日線。

## 6. 用手改 .env（唔好成份覆蓋）

用記事本開 `C:\Users\comfy\Desktop\openstock-paper\openstock-paper\.env`。

**留低**你原有嘅 `MONGODB_URI`、`BETTER_AUTH_SECRET`、`FINNHUB_API_KEY`。Finnhub 仍然負責報價。

喺檔案尾加（密鑰留空就係 OpenD 冇設密鑰；有就填你抄低嗰串）：

```env
HISTORY_PROVIDER=futu
FUTU_OPEND_HOST=127.0.0.1
FUTU_OPEND_PORT=33333
FUTU_OPEND_KEY=
```

`FUTU_OPEND_PORT` 一定要係第 5 步個 **WebSocket** 端口。填 11111 會連唔上。

## 7. 裝新依賴同再開

呢次加咗 `futu-api`，要裝依賴。

```powershell
Set-Location -LiteralPath "C:\Users\comfy\Desktop\openstock-paper\openstock-paper"
npm.cmd ci
npm.cmd run dev -- --hostname 127.0.0.1
```

瀏覽器開 http://localhost:3000 ，入模擬交易，撳「立即分析」。

- 成功嘅話，歷史來源會寫 **富途 OpenD**。報價來源仍然係 Finnhub。
- 如果寫「連不上富途 OpenD」，檢查 OpenD 開咗未、WebSocket 端口同 `.env` 係咪一樣。
- 如果寫「行情權限」或者「額度已用完」，就係富途帳戶限制，唔會改用假日線落單。

呢次測試冇連你部機嘅 OpenD，亦冇改你嘅 `.env`。唔代表策略會賺錢。

## 檔案清單

今次 ZIP 只係上一包之後改過嘅檔，共 14 個。唔包含 `.env`。

- `.env.example`
- `MANIFEST.txt`
- `UPDATE.md`
- `__tests__/futu-history.test.ts`
- `lib/paper-trading/futu-history.ts`
- `lib/paper-trading/history.ts`
- `lib/paper-trading/labels.ts`
- `lib/paper-trading/messages.ts`
- `lib/paper-trading/quotes.ts`
- `lib/paper-trading/strategy.ts`
- `next.config.ts`
- `package-lock.json`
- `package.json`
- `types/futu-api.d.ts`
