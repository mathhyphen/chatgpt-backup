# 多平台 AI 对话加密备份 / Encrypted Multi-Platform AI Chat Backup

> 中文文档在前，英文版见下方 [English version](#english-version)。
> Chinese first; scroll down for the [English version](#english-version).

---

## 这是什么

把 **ChatGPT / DeepSeek / Kimi / MiniMax** 四个平台的 AI 对话**加密**备份到 GitHub 公开仓库，用 GitHub Pages 提供一个「输入密码才能看」的在线浏览站点。本地保留原始对话（保真），公开仓库只存密文 + 脱敏后的知识图谱。

核心理念：**备份保真，发布加密**。

- 本地备份 -> 防账号被封后聊天记录丢失
- 加密发布 -> 防本地硬盘损坏 / 电脑丢失
- 脱敏蒸馏 -> 把对话提炼成可复用的结构化知识单元

## 隐私保护（重要）

本仓库已做隐私过滤，**三层防护**：

### 1. 导出脱敏（文本层）
DeepSeek / Kimi / MiniMax 导出器内置 `REDACT_PATTERNS` + `sanitize()`，导出时即抹除：
- 中国手机号 `1[3-9]xxxxxxxxx`、国际电话 `+xxxxxxxxxxxx`
- 邮箱、身份证号（18 位）
- API key（`sk-...`、`xxx_api_key=...`）
- Bearer token、JWT（`eyJ...`）

### 2. AES-256-GCM 加密（发布层）
所有对话原文与知识单元都以 `.enc` 密文存于公开仓库：
- 密钥由密码经 **PBKDF2-HMAC-SHA256**（盐 16 字节随机，210000 次迭代）派生
- 盐与迭代次数公开存于 `cfg.js`（PBKDF2 设计上盐可公开），**密码 / 密钥从不入库**
- 解密完全在浏览器本地用 Web Crypto API 完成，密码从不上传

### 3. .gitignore 拦截
登录态（`.pw_profile/`，含 cookie）、Python venv、`__pycache__`、调试临时文件均不进仓库。

### 明文扫描验证
公开的明文只有 `graph.json`（3D 图谱的脱敏节点摘要）。对 183KB 的 `graph.json` 全文扫描：邮箱、手机、电话、API key、Bearer、JWT、身份证号 **均为 0 命中**。

> ChatGPT 对话走「本地保真 + 发布整体加密」路径（无导出脱敏）：明文 Markdown 只存本地 `~/ChatGPT备份`，从不离开本机；发布时整体加密为 `.enc`。

## 站点功能

浏览器打开 Pages 链接，输入密码后可：

- **知识图录**：浏览从对话中蒸馏出的结构化 wiki 知识单元（按标签聚类）
- **对话原档**：按标题 / 时间查看原始对话全文（含图片）
- **3D 知识图谱**：`graph.html`，脱敏知识单元构成的力导向 3D 图谱，可拖拽 / 缩放 / 聚焦

## 仓库结构

```
site/                      # GitHub Pages 站点（本仓库）
├── index.html             # 加密查看器（知识图录 + 对话原档）
├── graph.html             # 3D 知识图谱查看器
├── graph.json             # 脱敏知识图谱数据（明文，已脱敏）
├── cfg.js                 # 加密参数（盐 + 迭代次数，非敏感）
├── manifest.enc           # 加密的对话清单
├── data/
│   ├── *.enc              # 加密的 wiki 知识单元
│   └── conv/*.enc         # 加密的原始对话
├── vendor/                # 前端依赖
└── graphify_to_star.py    # 图谱格式转换辅助脚本
```

源码工作区（本地，不入库）含四个平台的抓取器、聚类脚本、加密发布脚本 `publish.py`、图片加密模块 `assets.py` 等。

## 支持平台

| 平台 | 抓取方式 | 导出脱敏 | 发布加密 |
|---|---|---|---|
| ChatGPT | Codex CLI 的 OAuth token 调内部 backend-api | 本地保真，不脱敏 | ✅ AES-256-GCM |
| DeepSeek | 网页内部 API 逆向 | ✅ `sanitize()` | ✅ AES-256-GCM |
| Kimi | 网页内部 API 逆向（chat/list + segment） | ✅ `sanitize()` | ✅ AES-256-GCM |
| MiniMax | 网页内部 API 逆向 | ✅ `sanitize()` | ✅ AES-256-GCM |

## 加密参数

- **密钥派生**：PBKDF2-HMAC-SHA256，salt 16B 随机，iterations 210000（OWASP 2023 推荐）
- **对称加密**：AES-256-GCM（认证加密，篡改即失败）
- **格式**：`IV(12B) + ciphertext + GCM tag(16B)`，与浏览器 Web Crypto API 严格对齐
- **图片**：内容寻址（sha256 文件名去重），AES-256-GCM 加密后存独立 assets 仓库，浏览器按需 fetch 解密

## 使用

### 日常备份（本地）
```bash
python backup_chatgpt.py              # ChatGPT 增量备份
python deepseek_export.py             # DeepSeek 导出
python kimi_export.py                 # Kimi 导出
python minimax_export.py              # MiniMax 导出
```

### 加密发布到 GitHub Pages
```bash
# 1. 加密并本地预览（不推送）
python publish.py --dry-run
cd site && python -m http.server 8000   # 浏览器打开 http://localhost:8000 验证

# 2. 正式加密 + 推送
python publish.py
# 按提示输入密码 + GitHub 仓库地址

# 3. GitHub 仓库 Settings -> Pages，Source 选 main 分支根目录
# 4. 访问 https://<用户名>.github.io/<仓库名>/
```

### 环境变量

| 变量 | 作用 | 默认值 |
|---|---|---|
| `CHATGPT_BACKUP_DIR` | 本地备份源目录 | `~/ChatGPT备份` |
| `CHATGPT_PUBLISH_SITE` | 站点输出目录 | `~/chatgpt-backup/site` |
| `CHATGPT_PUBLISH_PW` | 密码（非交互） | 无，交互输入 |

## 安全说明

- 公开仓库里只有密文 + 公开盐；没有密码无法派生密钥，无法解密
- 密码只在浏览器本地使用，**从不上传、从不存储**
- **密码丢失 = 备份不可读**，请用密码管理器保存
- 错误密码：GCM 认证失败，提示「密码错误或数据损坏」，不泄露任何信息
- 换密码：重新跑 `publish.py` 输入新密码，会用新 salt + 新密码重新加密全部内容并推送，旧密文被覆盖

## 限制

- 加密后无法在 Pages 上做全文搜索（密文搜不了），只能按标题搜
- GitHub Pages 有仓库 1GB / 单文件 100MB 限制，超大量对话 + 图片可能需分仓
- 依赖各平台 token，过期需重新登录（OAuth token 有效期较长但非永久）

---

# English version

## What is this

An **encrypted** backup of AI conversations from **ChatGPT / DeepSeek / Kimi / MiniMax**, published to a public GitHub repo and served via GitHub Pages as a "type password to read" site. Original conversations are kept locally (lossless); the public repo stores only ciphertext + sanitized knowledge graph.

Core principle: **backup lossless, publish encrypted.**

- Local backup -> guards against account bans
- Encrypted publish -> guards against disk failure / lost device
- Sanitized distillation -> distills conversations into reusable structured knowledge units

## Privacy (important)

This repo is privacy-filtered with **three layers of protection**:

### 1. Export sanitization (text layer)
The DeepSeek / Kimi / MiniMax exporters ship `REDACT_PATTERNS` + `sanitize()` that scrub at export time:
- Chinese mobile `1[3-9]xxxxxxxxx`, international `+xxxxxxxxxxxx`
- Email, national ID (18-digit)
- API keys (`sk-...`, `xxx_api_key=...`)
- Bearer tokens, JWTs (`eyJ...`)

### 2. AES-256-GCM encryption (publish layer)
All conversation text and knowledge units are stored as `.enc` ciphertext in the public repo:
- Key derived from a password via **PBKDF2-HMAC-SHA256** (random 16-byte salt, 210000 iterations)
- Salt + iterations are public in `cfg.js` (PBKDF2 salts are safe to publish); the **password / key never enters the repo**
- Decryption happens entirely in-browser via Web Crypto API; the password is never uploaded

### 3. .gitignore guards
Login state (`.pw_profile/`, contains cookies), Python venv, `__pycache__`, and debug scratch files are excluded.

### Plaintext scan
The only public plaintext is `graph.json` (sanitized node summaries for the 3D graph). A full scan of the 183KB `graph.json` found **0 matches** for email, mobile, phone, API key, Bearer, JWT, or national ID.

> ChatGPT conversations take the "local-lossless + whole-file encryption" path (no export sanitization): plaintext Markdown stays in `~/ChatGPT备份` and never leaves the machine; on publish it is encrypted wholesale into `.enc`.

## Site features

Open the Pages URL in a browser, enter the password, and you can:

- **Knowledge catalog** (知识图录): browse structured wiki units distilled from conversations, clustered by tag
- **Conversation archive** (对话原档): read full original conversations (with images) by title / time
- **3D knowledge graph**: `graph.html`, a force-directed 3D graph of sanitized knowledge units - drag / zoom / focus

## Repo structure

```
site/                      # GitHub Pages site (this repo)
├── index.html             # encrypted viewer (catalog + archive)
├── graph.html             # 3D knowledge graph viewer
├── graph.json             # sanitized graph data (plaintext, redacted)
├── cfg.js                 # crypto params (salt + iterations, non-sensitive)
├── manifest.enc           # encrypted conversation manifest
├── data/
│   ├── *.enc              # encrypted wiki units
│   └── conv/*.enc         # encrypted original conversations
├── vendor/                # frontend deps
└── graphify_to_star.py    # graph format adapter
```

The local source workspace (not committed) holds per-platform scrapers, clustering scripts, the `publish.py` encryption pipeline, and the `assets.py` image-encryption module.

## Supported platforms

| Platform | Capture method | Export sanitize | Publish encrypt |
|---|---|---|---|
| ChatGPT | Codex CLI OAuth token -> internal backend-api | local-lossless, no sanitize | ✅ AES-256-GCM |
| DeepSeek | reverse-engineered web API | ✅ `sanitize()` | ✅ AES-256-GCM |
| Kimi | reverse-engineered web API (chat/list + segment) | ✅ `sanitize()` | ✅ AES-256-GCM |
| MiniMax | reverse-engineered web API | ✅ `sanitize()` | ✅ AES-256-GCM |

## Crypto parameters

- **KDF**: PBKDF2-HMAC-SHA256, random 16B salt, 210000 iterations (OWASP 2023)
- **Cipher**: AES-256-GCM (authenticated, tamper -> fail)
- **Format**: `IV(12B) + ciphertext + GCM tag(16B)`, aligned with browser Web Crypto API
- **Images**: content-addressed (sha256 dedup), AES-256-GCM encrypted into a separate assets repo, fetched + decrypted on demand

## Usage

### Daily backup (local)
```bash
python backup_chatgpt.py              # ChatGPT incremental
python deepseek_export.py             # DeepSeek export
python kimi_export.py                 # Kimi export
python minimax_export.py              # MiniMax export
```

### Encrypted publish to GitHub Pages
```bash
# 1. Encrypt and preview locally (no push)
python publish.py --dry-run
cd site && python -m http.server 8000   # open http://localhost:8000 to verify

# 2. Encrypt + push for real
python publish.py
# enter password + GitHub repo URL when prompted

# 3. GitHub repo Settings -> Pages, Source = main branch root
# 4. Visit https://<user>.github.io/<repo>/
```

### Environment variables

| Variable | Purpose | Default |
|---|---|---|
| `CHATGPT_BACKUP_DIR` | local backup source dir | `~/ChatGPT备份` |
| `CHATGPT_PUBLISH_SITE` | site output dir | `~/chatgpt-backup/site` |
| `CHATGPT_PUBLISH_PW` | password (non-interactive) | none, interactive |

## Security notes

- The public repo holds only ciphertext + a public salt; without the password the key cannot be derived and nothing can be decrypted
- The password is used only in-browser, **never uploaded, never stored**
- **Losing the password = backups are unreadable** - keep it in a password manager
- Wrong password: GCM auth fails, shows "password incorrect or data corrupted", leaks nothing
- Re-keying: rerun `publish.py` with a new password; it re-encrypts everything with a fresh salt and pushes, overwriting old ciphertext

## Limitations

- No full-text search on Pages (ciphertext is not searchable); title search only
- GitHub Pages limits: 1GB per repo / 100MB per file; very large conversation + image sets may need repo splitting
- Depends on per-platform tokens; expired tokens require re-login (OAuth tokens last a while but not forever)
