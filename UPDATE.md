﻿# 穩步 SteadyTrade 更新（安全修正 + 繁體中文 + 改名）

呢個壓縮檔係**由你原本個 `openstock-paper` 源碼包到而家**所有改過嘅檔，一次過蓋上去就得。入面有：

- 模擬交易安全修正（冇真實日線就唔會落單）
- 繁體中文介面
- 個名改做 **穩步 SteadyTrade**（新圖示係向量圖，唔係張 JPG）

請蓋去：

`C:\Users\comfy\Desktop\openstock-paper\openstock-paper`

呢份說明用 UTF-8（有 BOM）。如果 PowerShell 5.1 出亂碼，用記事本開，或者：

```powershell
Get-Content -Encoding UTF8 .\UPDATE.md
```

原專案係 Open-Dev-Society 嘅 OpenStock，授權 **AGPL-3.0**（`LICENSE` 冇改）。頁尾有一句：基於 OpenStock（AGPL-3.0）修改。

---

## 安裝之前

- 呢次**冇改** `package.json` 同 `package-lock.json`，所以平常**唔使** `npm.cmd ci`。
- **唔好**覆蓋 `.env`。唔好清 Atlas，亦唔好撳「重設模擬賬簿」。
- 我哋喺另一部機跑過測試同編譯。**未連你嘅 Atlas，亦未喺你部 Windows 跑過。** 唔代表你部機已經搞好，亦唔保證策略賺錢。
- `npm audit` 仍然係 25 項（10 中、14 高、1 嚴重）。嚴重嗰項係建置工具帶入嚟嘅 `tar`。冇強制升級。請只開 `http://localhost:3000`。

---

## PowerShell 5.1 步驟

### 1. 停伺服器

去緊跑 `npm run dev` 嗰個視窗，按 `Ctrl+C`，等到返到提示字元。

### 2. 備份成個資料夾

```powershell
$dst = "C:\Users\comfy\Desktop\openstock-paper\openstock-paper"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
Copy-Item -LiteralPath $dst -Destination ($dst + "-backup-" + $stamp) -Recurse -Force
```

備份入面有你嘅 `.env`。唔好上傳或者寄畀人。

### 3. 解壓

假設壓縮檔放咗喺桌面，檔名 `openstock-paper-zh-safety-update.zip`：

```powershell
$zip = "C:\Users\comfy\Desktop\openstock-paper-zh-safety-update.zip"
$src = "C:\Users\comfy\Desktop\openstock-paper-update"
if (Test-Path -LiteralPath $src) { Remove-Item -LiteralPath $src -Recurse -Force }
Expand-Archive -LiteralPath $zip -DestinationPath $src
```

### 4. 複製檔案，但唔好覆蓋 `.env`

```powershell
$src = "C:\Users\comfy\Desktop\openstock-paper-update"
$dst = "C:\Users\comfy\Desktop\openstock-paper\openstock-paper"
Get-ChildItem -LiteralPath $src -Recurse -File | ForEach-Object {
  if ($_.Name -eq ".env") { return }
  $rel = $_.FullName.Substring((Resolve-Path -LiteralPath $src).Path.Length).TrimStart("\")
  $target = Join-Path $dst $rel
  $folder = Split-Path -Parent $target
  if (-not (Test-Path -LiteralPath $folder)) { New-Item -ItemType Directory -Force -Path $folder | Out-Null }
  Copy-Item -LiteralPath $_.FullName -Destination $target -Force
}
Test-Path -LiteralPath "C:\Users\comfy\Desktop\openstock-paper\openstock-paper\.env"
```

最後一行應該係 `True`。唔好用 `.env.example` 取代 `.env`。

### 5. 依賴

呢次冇改依賴，可以跳過。如果 `node_modules` 唔見咗，先至行：

```powershell
Set-Location -LiteralPath "C:\Users\comfy\Desktop\openstock-paper\openstock-paper"
npm.cmd ci
```

### 6. 開返個程式

```powershell
Set-Location -LiteralPath "C:\Users\comfy\Desktop\openstock-paper\openstock-paper"
npm.cmd run dev -- --hostname 127.0.0.1
```

瀏覽器開 http://localhost:3000

登入頁同左邊選單應該見到 **SteadyTrade** 同 **穩步**。模擬交易嘅自動提交仍然預設關閉。

---

## 檔案清單

共 99 個檔。完整名單亦喺 `MANIFEST.txt`。壓縮檔唔包含 `.env`、`.git`、`node_modules`、`.next`。

- `.env.example`
- `MANIFEST.txt`
- `PAPER-TRADING-NOTICE.md`
- `README.md`
- `UPDATE.md`
- `__tests__/alert-actions.test.ts`
- `__tests__/paper-trading-safety.test.ts`
- `__tests__/zh-hant-ui.test.ts`
- `app/(auth)/forgot-password/page.tsx`
- `app/(auth)/layout.tsx`
- `app/(auth)/reset-password/ResetPasswordForm.tsx`
- `app/(auth)/sign-in/page.tsx`
- `app/(auth)/sign-up/page.tsx`
- `app/(marketing)/about/page.tsx`
- `app/(marketing)/api-docs/page.tsx`
- `app/(marketing)/changelog/page.tsx`
- `app/(marketing)/compare/[slug]/page.tsx`
- `app/(marketing)/compare/page.tsx`
- `app/(marketing)/help/page.tsx`
- `app/(marketing)/layout.tsx`
- `app/(marketing)/page.tsx`
- `app/(marketing)/s/[ticker]/page.tsx`
- `app/(marketing)/s/page.tsx`
- `app/(marketing)/sponsor/page.tsx`
- `app/(marketing)/terms/page.tsx`
- `app/(root)/dashboard/page.tsx`
- `app/(root)/paper-trading/page.tsx`
- `app/(root)/profile/page.tsx`
- `app/(root)/stocks/[symbol]/page.tsx`
- `app/(root)/watchlist/page.tsx`
- `app/favicon.ico`
- `app/globals.css`
- `app/icon.png`
- `app/layout.tsx`
- `app/manifest.ts`
- `components/DataFreshness.tsx`
- `components/MarketSwitcher.tsx`
- `components/SearchCommand.tsx`
- `components/TradingViewWidget.tsx`
- `components/WatchlistButton.tsx`
- `components/brand/SteadyTradeLogo.tsx`
- `components/forms/CountrySelectField.tsx`
- `components/forms/SocialAuthButtons.tsx`
- `components/landing/ProductPreview.tsx`
- `components/paper-trading/PaperTradingClient.tsx`
- `components/profile/PasswordForm.tsx`
- `components/profile/ProfileForm.tsx`
- `components/shell/Sidebar.tsx`
- `components/shell/TabBar.tsx`
- `components/sponsors/SponsorsBand.tsx`
- `components/stocks/StockChart.tsx`
- `components/stocks/StockHeader.tsx`
- `components/watchlist/AlertsPanel.tsx`
- `components/watchlist/CreateAlertModal.tsx`
- `components/watchlist/NewsList.tsx`
- `components/watchlist/WatchlistTable.tsx`
- `database/models/paper-account.model.ts`
- `database/models/paper-idempotency.model.ts`
- `database/models/paper-order.model.ts`
- `database/models/paper-position.model.ts`
- `database/models/strategy-signal.model.ts`
- `lib/actions/alert.actions.ts`
- `lib/actions/auth.actions.ts`
- `lib/actions/paper-trading.actions.ts`
- `lib/actions/profile.actions.ts`
- `lib/actions/watchlist.actions.ts`
- `lib/constants.ts`
- `lib/i18n/format.ts`
- `lib/i18n/zh-Hant.ts`
- `lib/inngest/functions.ts`
- `lib/inngest/prompts.ts`
- `lib/nodemailer/index.ts`
- `lib/nodemailer/reset-password.ts`
- `lib/nodemailer/templates.ts`
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
- `lib/seo/comparisons.ts`
- `lib/utils.ts`
- `next-env.d.ts`
- `public/brand/steadytrade-icon.svg`
- `public/brand/steadytrade-wordmark.svg`
- `public/favicon.ico`
- `public/icons/apple-touch-icon.png`
- `public/icons/icon-16.png`
- `public/icons/icon-180.png`
- `public/icons/icon-192.png`
- `public/icons/icon-32.png`
- `public/icons/icon-48.png`
- `public/icons/icon-512.png`
- `tsconfig.tsbuildinfo`
