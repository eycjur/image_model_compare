# 画像生成AI比較サイト

DALLE-2、DALLE-3、Geminiなどの画像生成AIの結果を比較できるPure JavaScriptアプリケーションです。

## 🚀 特徴

- **多モデル対応**: DALLE-2、DALLE-3、Gemini の同時比較
- **2つの生成モード**:
  - テキストプロンプトのみ
  - 画像 + テキストプロンプト（画像編集）
- **ドラッグ&ドロップ**: 画像ファイルの簡単アップロード
- **リアルタイム状態**: 各モデルの生成進捗と時間表示
- **レスポンシブデザイン**: モバイル対応
- **依存関係なし**: Pure JavaScript + TailwindCSS CDN

## 🛠️ 技術スタック

- **フロントエンド**: Pure JavaScript (ES6+)
- **スタイリング**: TailwindCSS (CDN)
- **バンドラー**: なし（シンプル構成）

## 📦 セットアップ

### クイックスタート

```bash
# リポジトリをクローン後
open index.html
# または
python3 -m http.server 8000
# http://localhost:8000 でアクセス
```

**必要なファイル:**
- `index.html` - メインHTML
- `script.js` - JavaScript実装

それだけです！

## 🔑 使用方法

### APIキーの準備

1. **OpenAI API Key**: [OpenAI Platform](https://platform.openai.com/) でAPIキーを取得
2. **Gemini API Key**: [Google AI Studio](https://makersuite.google.com/app/apikey) でAPIキーを取得

### 基本的な使い方

#### 1. テキストモード
1. プロンプト入力欄に生成したい画像の説明を入力
2. OpenAI API KeyとGemini API Keyを入力
3. 「画像を生成して比較」ボタンをクリック

#### 2. 画像+テキストモード
1. 「画像 + テキスト」モードを選択
2. 参考画像をアップロード（ドラッグ&ドロップまたはクリック）
3. 画像への変更指示をテキストで入力
4. APIキーを入力
5. 「画像を生成して比較」ボタンをクリック

## ⚠️ API制限事項

### CORS問題
ブラウザから直接APIを呼び出すため、一部のAPIでCORSエラーが発生する可能性があります：

- **OpenAI API**: 基本的に動作しますが、制限がある場合があります
- **Gemini API**: CORS制限によりエラー時はフォールバック画像を表示

### CORS回避方法

**1. ローカルサーバー起動**
```bash
# Python
python3 -m http.server 8000

# Node.js
npx serve .

# PHP
php -S localhost:8000
```

**2. CORS無効化ブラウザ（開発用）**
```bash
# Chrome
google-chrome --disable-web-security --user-data-dir="/tmp/chrome_dev"
```

## 🔧 カスタマイズ

### 新しいAIモデルの追加

1. **CONFIG.API**に新しいAPI設定を追加
2. **state.models**に新しいモデル状態を追加
3. **HTML**に新しいカードを追加
4. **JavaScript**に生成関数を追加

```javascript
// 例: 新しいモデル追加
CONFIG.API.NEWMODEL = {
    URL: 'https://api.example.com/generate',
    // ...
};

async function generateNewModel(prompt, isImageMode) {
    // 実装
}
```

## 📁 ファイル構造

```
.
├── index.html          # メインHTML（CDN使用）
├── script.js           # JavaScript実装
└── README.md          # このファイル
```

## 🌟 Pure JavaScriptの利点

- **シンプル**: 設定ファイルやビルド不要
- **高速**: ブラウザで直接実行
- **軽量**: 依存関係なし
- **理解しやすい**: 標準的なJavaScript

## 🔒 セキュリティ注意事項

- **APIキー**: ブラウザのローカルストレージには保存しません
- **本番環境**: APIキーをフロントエンドで直接使用することは推奨されません
- **推奨**: 実運用時はバックエンドサーバー経由でAPI呼び出し

## 📄 ライセンス

MIT License