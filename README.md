<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/1db97375-ace1-4357-bc41-b4127e9da8db

## Update: 2026-04-25

### 团队长和组长界面优化
- 优化了团队长界面的刷新逻辑，实现了静默刷新功能
- 修改了团队长收益接口，使用新的后端API
- 修复了团队长员工总数计算逻辑，与账号管理页面保持一致
- 优化了组长界面的缓存逻辑，提高页面响应速度
- 修复了各角色的颜色显示逻辑，确保正确的颜色判断

## Update: 2026-04-14

### 福利抽奖管理功能
- 新增福利抽奖管理模块，位于幸运彩票管理下方
- 实现了奖品管理功能，支持调整奖品概率
- 实现了待处理提现功能，支持标记为已到账或失败
- 实现了提现记录功能，显示所有提现历史
- 对接了后端API，支持奖品概率更新和提现处理

## Update: 2026-03-26

### 幸运彩票管理功能
- 修复了彩票功能开关的点击切换问题
- 合并了奖金比例和获奖人数设置，使界面更加紧凑
- 优化了开奖流程，添加了二次确认弹窗
- 简化了期号输入，由后端自动处理
- 动态更新使用说明中的奖金分配信息
- 统一金额显示为两位小数，避免显示过多小数位

## Update: 2026-03-19

Updated to fix deployment issues and improve build process.

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
