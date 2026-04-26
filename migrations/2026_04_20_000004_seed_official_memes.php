<?php

use Illuminate\Database\Schema\Builder;

return [
    'up' => function (Builder $schema) {
        $db = $schema->getConnection();
        $packageMemeDir = dirname(__DIR__) . '/meme';

        if (!is_dir($packageMemeDir)) {
            return;
        }

        $now = date('Y-m-d H:i:s');
        $rows = [];
        $entries = scandir($packageMemeDir) ?: [];
        foreach ($entries as $file) {
            if ($file === '.' || $file === '..') continue;
            $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
            if (!in_array($ext, ['png', 'jpg', 'jpeg', 'gif', 'webp'], true)) continue;

            $src = $packageMemeDir . '/' . $file;

            $mime = match ($ext) {
                'png' => 'image/png',
                'jpg', 'jpeg' => 'image/jpeg',
                'gif' => 'image/gif',
                'webp' => 'image/webp',
            };

            $size = @filesize($src) ?: 0;
            $displayName = pathinfo($file, PATHINFO_FILENAME);

            $rows[] = [
                'type' => 'official',
                'uploader_id' => null,
                'filename' => $file,
                'original_filename' => $file,
                'display_name' => $displayName,
                'status' => 'approved',
                'rejection_reason' => null,
                'rejected_at' => null,
                'size' => $size,
                'mime' => $mime,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        if (empty($rows)) {
            return;
        }

        foreach (array_chunk($rows, 100) as $chunk) {
            $db->table('meme_items')->insertOrIgnore($chunk);
        }
    },

    'down' => function (Builder $schema) {
        $schema->getConnection()->table('meme_items')
            ->where('type', 'official')
            ->whereNull('uploader_id')
            ->delete();
    },
];
