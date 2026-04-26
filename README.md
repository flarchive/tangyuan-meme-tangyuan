# Meme Tangyuan

[![Latest Stable Version](https://img.shields.io/packagist/v/tangyuan/meme-tangyuan.svg)](https://packagist.org/packages/tangyuan/meme-tangyuan)
[![Total Downloads](https://img.shields.io/packagist/dt/tangyuan/meme-tangyuan.svg)](https://packagist.org/packages/tangyuan/meme-tangyuan)
[![License](https://img.shields.io/packagist/l/tangyuan/meme-tangyuan.svg)](https://packagist.org/packages/tangyuan/meme-tangyuan)

A Flarum extension that adds a meme/sticker picker to the post composer. Ships with a curated library of 280+ expressive stickers, and supports per-user favorites and custom names.

## Features

- Meme picker button in the post composer toolbar
- Search by filename / custom name
- Per-user favorites (right-click an item to favorite)
- Per-user custom display names (right-click → Set Custom Name)
- Images served through a cached static path for fast delivery
- Ships with 280+ webp stickers out of the box
- BBCode `[tangyuan-meme src="..."][/tangyuan-meme]` rendered as an inline image in posts

## Installation

```bash
composer require tangyuan/meme-tangyuan:"*"
```

Then enable the **Meme Tangyuan** extension in your Flarum admin panel.

## Updating

```bash
composer update tangyuan/meme-tangyuan
php flarum cache:clear
php flarum migrate
```

## Adding your own memes

Place additional `.png`, `.jpg`, `.jpeg`, `.gif`, or `.webp` files into the extension's `meme/` directory:

```
vendor/tangyuan/meme-tangyuan/meme/
```

Then clear the Flarum cache:

```bash
php flarum cache:clear
```

Files are copied into `public/assets/meme-cache/` on first request.

## Usage

1. Start writing a post.
2. Click the sticker icon in the composer toolbar.
3. Click a meme to insert it into your post.
4. Right-click a meme to favorite it or set a custom display name (max 15 chars).
5. Switch to the **Favorites** tab to see only your starred memes.

## Development

```bash
# JS build
cd js
npm install
npm run build     # production build
npm run dev       # watch mode
```

## License

[MIT](LICENSE)

## Links

- [Packagist](https://packagist.org/packages/tangyuan/meme-tangyuan)
- [GitHub repository](https://github.com/Little-100/meme-tangyuan)
- [Report an issue](https://github.com/Little-100/meme-tangyuan/issues)
