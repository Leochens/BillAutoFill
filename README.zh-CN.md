# Bill AutoFill

简体中文 | [English](./README.md)

[![GuanTou Lab](https://world.guantou.site/badge.svg?theme=dark&accent=red&lang=zh&size=sm)](https://world.guantou.site/)

![Bill AutoFill 宣传图](./docs/assets/showcase-zh.png)

Bill AutoFill 是一个开源的 Chrome Manifest V3 浏览器扩展，用于生成虚拟账单资料，并辅助填写测试表单。它适合 QA、演示、沙盒表单、本地测试和隐私友好的测试数据工作流。

它不会自动提交表单，也不适用于真实购物、冒充他人、规避税费、填写银行卡、填写密码或处理政府证件信息。

## 功能特性

- 使用 Chrome 侧边栏工作流，用户点击页面其他地方时，扩展界面也会持续保留。
- 支持生成虚拟 profile，可配置国家、性别、美国免税州偏好等参数。
- 支持 AI 辅助识别页面字段，包括输入框、多行文本框和选择器。
- 可在 Options 页面通过 AI 预生成多个可复用 profile。
- 可在 Options 页面手动粘贴 JSON profile 并保存。
- 可在侧边栏选择 profile 后查看完整资料。
- 可在侧边栏临时粘贴 JSON profile，并优先使用这份资料填充。
- 填充前提供映射预览，展示字段置信度和简短可审计理由。
- 访问页面前按当前站点请求授权，不默认读取所有网站。
- 未配置 AI provider 时，也可以使用本地规则进行基础字段映射。

## 隐私模型

Bill AutoFill 是 local-first 设计，不包含开发者后台服务。

- 设置、API Key、可信域名和保存的虚拟 profile 会存储在 Chrome 扩展本地存储中。
- 如果用户配置了 AI provider，扩展可能会把安全的表单字段元数据发送给该 provider，用于字段映射。
- 字段元数据可能包括 label、name、id、placeholder、autocomplete、附近文本和 select options。
- 扩展不会有意发送用户已经输入到表单里的值。
- 密码字段、隐藏字段、银行卡字段、提交按钮、文件输入框和已有值会被忽略。
- 扩展不会自动提交表单。

更多细节见 [PRIVACY.md](./PRIVACY.md)。

## 从源码安装

```bash
npm install
npm run build
```

然后在 Chrome 中：

1. 打开 `chrome://extensions`。
2. 开启 Developer mode。
3. 点击 Load unpacked。
4. 选择生成出来的 `dist/` 目录。

## 开发

```bash
npm install
npm test
npm run build
```

常用文件：

- `src/background/serviceWorker.ts`：扩展主流程、页面权限、AI 调用和 profile 选择。
- `src/content/contentScript.ts`：字段提取和安全填充逻辑。
- `src/popup/PopupApp.tsx`：侧边栏界面。
- `src/options/OptionsApp.tsx`：Provider 设置和可复用 profile 管理。
- `src/shared/`：profile 生成、国家配置、存储、provider、校验和共享类型。
- `docs/manual-test-form.html`：本地手动测试表单。

## 手动测试

打开一个 `http` 或 `https` 的测试表单页面，点击扩展图标，然后在侧边栏中点击 `Identify & Fill`。第一次在某个站点填充时，扩展会请求当前站点权限；授权后会继续识别和填充流程。

你也可以使用 `docs/manual-test-form.html` 作为简单测试表单。建议通过本地 HTTP server 或任意静态服务器打开。除非确认是真正的沙盒环境，否则不要在真实 checkout 流程中测试。

## AI Provider

Options 页面支持 OpenAI、DeepSeek、Gemini 和自定义 OpenAI-compatible endpoint。API Key 由用户自行填写，并保存在 Chrome 扩展本地存储中。

未配置 API Key 时，Bill AutoFill 仍会使用本地启发式规则进行字段映射。

## 权限说明

- `storage`：保存设置、AI provider 配置和可复用虚拟 profile。
- `sidePanel`：让扩展界面在用户操作页面时持续保留。
- `scripting`：在用户操作并授权站点后注入 content script。
- `tabs`：读取当前 tab URL，用于请求和校验当前站点权限。
- `activeTab`：支持用户主动触发后的当前标签页访问。
- `optional_host_permissions`：仅当用户选择填充页面时，请求当前 `http` 或 `https` 站点访问权限。

## 贡献

见 [CONTRIBUTING.md](./CONTRIBUTING.md)。

## 安全

见 [SECURITY.md](./SECURITY.md)。

## License

MIT。见 [LICENSE](./LICENSE)。
