# 福利钱包提现管理系统

## 项目概述

这是一个福利钱包提现管理系统，提供完整的提现申请处理和记录管理功能。

## 功能特性

### 福利抽奖管理
- 抽奖管理：创建和管理抽奖活动
- 抽奖记录：查看抽奖历史记录

### 福利钱包提现管理
- 待处理提现：查看和处理待审核的提现申请
- 提现记录：查看所有提现历史记录（已到账、已失败）
- 批量处理：支持批量确认到账或拒绝提现
- 数据导出：支持导出提现记录为CSV文件

## 技术栈

- React + TypeScript
- Vite
- Tailwind CSS
- Axios

## 项目结构

```
├── pages/
│   ├── WelfareLotteryManagement.tsx  # 福利抽奖与提现管理主页面
│   ├── Management.tsx                # 管理页面
│   └── AccountManagement.tsx         # 账户管理页面
├── services/
│   └── cacheManager.ts               # 缓存管理服务
└── dist/                             # 构建产物
```

## 运行项目

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建生产版本
npm run build
```

## API接口

- `GET /api/welfare/admin/withdraw/list` - 获取待处理提现列表
- `GET /api/welfare/admin/withdraw/records` - 获取提现历史记录
- `POST /api/welfare/admin/withdraw/process` - 处理提现申请
