<?php

namespace Tangyuan\Meme\Service;

use Flarum\Foundation\Paths;
use Tangyuan\Meme\Model\Meme;

class MemeStorage
{
    public const CACHE_SUBDIR = 'meme-cache';

    public function __construct(private Paths $paths)
    {
    }

    public function getStorageBase(): string
    {
        return $this->paths->storage . '/memes';
    }

    public function getOfficialStorageDir(): string
    {
        return $this->getStorageBase() . '/official';
    }

    public function getUserStorageDir(int $userId): string
    {
        return $this->getStorageBase() . '/users/' . $userId;
    }

    public function getCacheBaseDir(): string
    {
        return $this->paths->public . '/assets/' . self::CACHE_SUBDIR;
    }

    public function getOfficialCacheDir(): string
    {
        return $this->getCacheBaseDir() . '/official';
    }

    public function getUserCacheDir(int $userId): string
    {
        return $this->getCacheBaseDir() . '/user/' . $userId;
    }

    public function getCacheBaseUrl(): string
    {
        return '/assets/' . self::CACHE_SUBDIR;
    }

    public function storagePathFor(Meme $meme): string
    {
        if ($meme->isOfficial()) {
            return $this->getOfficialStorageDir() . '/' . $meme->filename;
        }

        return $this->getUserStorageDir((int) $meme->uploader_id) . '/' . $meme->filename;
    }

    public function cachePathFor(Meme $meme): string
    {
        if ($meme->isOfficial()) {
            return $this->getOfficialCacheDir() . '/' . $meme->filename;
        }

        return $this->getUserCacheDir((int) $meme->uploader_id) . '/' . $meme->filename;
    }

    public function cacheUrlFor(Meme $meme): string
    {
        if ($meme->isOfficial()) {
            return $this->getCacheBaseUrl() . '/official/' . rawurlencode($meme->filename);
        }

        return $this->getCacheBaseUrl() . '/user/' . ((int) $meme->uploader_id) . '/' . rawurlencode($meme->filename);
    }

    public function ensureDir(string $dir): void
    {
        if (!is_dir($dir)) {
            @mkdir($dir, 0755, true);
        }
    }

    public function ensureCached(Meme $meme): bool
    {
        $source = $this->storagePathFor($meme);
        $cache = $this->cachePathFor($meme);

        if (!file_exists($source)) {
            return false;
        }

        if (file_exists($cache) && filemtime($cache) >= filemtime($source)) {
            return true;
        }

        $this->ensureDir(dirname($cache));
        return @copy($source, $cache);
    }

    public function ensureOfficialCachePrewarm(): void
    {
        $srcDir = $this->getOfficialStorageDir();
        if (!is_dir($srcDir)) {
            return;
        }

        $cacheDir = $this->getOfficialCacheDir();
        $this->ensureDir($cacheDir);

        $flagFile = $cacheDir . '/.prewarm';
        $srcMtime = @filemtime($srcDir) ?: 0;
        $flagMtime = file_exists($flagFile) ? (@filemtime($flagFile) ?: 0) : 0;

        if ($flagMtime > 0 && $flagMtime >= $srcMtime) {
            return;
        }

        foreach (scandir($srcDir) as $file) {
            if ($file === '.' || $file === '..' || $file === '.prewarm') continue;
            $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
            if (!in_array($ext, ['png', 'jpg', 'jpeg', 'gif', 'webp'], true)) continue;

            $target = $cacheDir . '/' . $file;
            $src = $srcDir . '/' . $file;
            if (!file_exists($target)) {
                @copy($src, $target);
            }
        }

        @touch($flagFile);
    }

    public function deleteMemeFiles(Meme $meme): void
    {
        $source = $this->storagePathFor($meme);
        if (file_exists($source)) {
            @unlink($source);
        }

        $cache = $this->cachePathFor($meme);
        if (file_exists($cache)) {
            @unlink($cache);
        }
    }

    public function getUserTotalSize(int $userId): int
    {
        $dir = $this->getUserStorageDir($userId);
        if (!is_dir($dir)) {
            return 0;
        }
        $total = 0;
        foreach (scandir($dir) ?: [] as $file) {
            if ($file === '.' || $file === '..') continue;
            $path = $dir . '/' . $file;
            if (is_file($path)) {
                $total += filesize($path) ?: 0;
            }
        }
        return $total;
    }

    public function buildUniqueFilename(int $uploaderId, string $originalName, ?string $username = null): string
    {
        $ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
        $base = pathinfo($originalName, PATHINFO_FILENAME);
        $base = preg_replace('/[^\p{L}\p{N}_\-]/u', '_', $base) ?: 'meme';
        $base = mb_substr($base, 0, 64);

        // Prefix with username to prevent cross-user naming conflicts
        if ($username) {
            $prefix = preg_replace('/[^\p{L}\p{N}_\-]/u', '_', $username);
            $prefix = mb_substr($prefix, 0, 32);
            $base = $prefix . '_' . $base;
        }

        $dir = $this->getUserStorageDir($uploaderId);
        $this->ensureDir($dir);

        $filename = $base . '.' . $ext;
        $counter = 1;
        while (file_exists($dir . '/' . $filename)) {
            $filename = $base . '_' . $counter . '.' . $ext;
            $counter++;
        }

        return $filename;
    }

    public function getPackageBuiltInDir(): string
    {
        return dirname(__DIR__, 2) . '/meme';
    }

    /**
     * Copies the 289 built-in memes from the extension's meme/ directory
     * into the writable storage path on first run. Idempotent — no-op once
     * every file is present.
     */
    public function ensureBuiltInOfficialFilesSeeded(): void
    {
        $src = $this->getPackageBuiltInDir();
        if (!is_dir($src)) {
            return;
        }

        $dest = $this->getOfficialStorageDir();
        $this->ensureDir($dest);

        $flag = $dest . '/.builtin-seeded';
        if (file_exists($flag)) {
            return;
        }

        foreach (scandir($src) ?: [] as $file) {
            if ($file === '.' || $file === '..') continue;
            $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
            if (!in_array($ext, ['png', 'jpg', 'jpeg', 'gif', 'webp'], true)) continue;
            $target = $dest . '/' . $file;
            if (!file_exists($target)) {
                @copy($src . '/' . $file, $target);
            }
        }

        @touch($flag);
    }
}
