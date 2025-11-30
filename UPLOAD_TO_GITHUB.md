# Як завантажити проект у ваш GitHub репозиторій

Ваш репозиторій: `https://github.com/Chikh124/twitterpost-scrapper`

## Крок 1: Відкрийте термінал у папці проекту

Відкрийте PowerShell або CMD у папці: `F:\Vibeprojc\xscarp`

## Крок 2: Виконайте команди по черзі

### Якщо Git ще не ініціалізовано:

```bash
git init
git add .
git commit -m "Add Twitter/X data extractor project"
git branch -M main
git remote add origin https://github.com/Chikh124/twitterpost-scrapper.git
git push -u origin main
```

### Якщо Git вже ініціалізовано (є .git папка):

```bash
git add .
git commit -m "Add Twitter/X data extractor project"
git branch -M main
git remote add origin https://github.com/Chikh124/twitterpost-scrapper.git
git push -u origin main
```

### Якщо remote вже додано:

```bash
git add .
git commit -m "Add Twitter/X data extractor project"
git push -u origin main
```

### Якщо виникла помилка "non-fast-forward" (як у вас):

Це означає, що на GitHub вже є файли. Потрібно об'єднати зміни:

**Варіант 1: Об'єднати зміни (рекомендовано)**

```bash
git pull origin main --allow-unrelated-histories
# Якщо виникне конфлікт, вирішіть його, потім:
git add .
git commit -m "Merge remote and local changes"
git push -u origin main
```

**Варіант 2: Перезаписати remote (якщо на GitHub тільки .gitignore)**

```bash
git push -u origin main --force
```

⚠️ **Увага**: `--force` перезапише всі файли на GitHub! Використовуйте тільки якщо впевнені.

## Крок 3: Якщо виникнуть проблеми

### Помилка: "remote origin already exists"

```bash
git remote remove origin
git remote add origin https://github.com/Chikh124/twitterpost-scrapper.git
git push -u origin main
```

### Помилка: "Authentication failed"

GitHub тепер вимагає Personal Access Token:

1. Перейдіть: https://github.com/settings/tokens
2. Натисніть **"Generate new token"** → **"Generate new token (classic)"**
3. Назвіть: "twitterpost-scrapper"
4. Виберіть scope: **repo** (повний доступ)
5. Натисніть **"Generate token"**
6. Скопіюйте токен
7. При `git push` використовуйте:
   - Username: ваш GitHub username
   - Password: вставте токен (не пароль!)

### Помилка: "branch main does not exist"

```bash
git checkout -b main
git push -u origin main
```

## Альтернатива: GitHub Desktop

Якщо командний рядок не працює:

1. Завантажте: https://desktop.github.com/
2. Встановіть та увійдіть
3. File → Add Local Repository
4. Виберіть папку: `F:\Vibeprojc\xscarp`
5. Натисніть "Publish repository" або "Push origin"

## Перевірка

Після завантаження:
- Відкрийте: https://github.com/Chikh124/twitterpost-scrapper
- Переконайтеся, що всі файли на місці
- Переконайтеся, що `.env` файл **НЕ** завантажився

