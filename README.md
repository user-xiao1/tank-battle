# 坦克大战 Tank Battle

一个使用 HTML5 Canvas + JavaScript 制作的坦克大战小游戏。

## 在线试玩

用浏览器直接打开 `index.html` 即可开始游戏。

## 操作说明

| 按键 | 功能 |
|------|------|
| `W` / `A` / `S` / `D` 或方向键 | 移动坦克 |
| 鼠标移动 | 瞄准 |
| 鼠标左键 | 射击 |
| `R` | 重新开始 |

## 游戏特性

- 🎮 玩家坦克与敌方 AI 坦克对战
- 🧱 带碰撞检测的砖墙障碍物
- 🔥 爆炸粒子效果
- 📈 波次递进，敌人会越来越强
- ❤️ 生命值与得分系统

## 文件结构

```
tank-battle/
├── index.html    # 页面结构
├── style.css     # 游戏样式
├── game.js       # 游戏逻辑
└── README.md     # 项目说明
```

## 本地运行

```bash
git clone https://github.com/你的用户名/tank-battle.git
cd tank-battle
# 直接用浏览器打开 index.html，或使用任意静态服务器
python -m http.server 8000
```

然后在浏览器访问 `http://localhost:8000`。
