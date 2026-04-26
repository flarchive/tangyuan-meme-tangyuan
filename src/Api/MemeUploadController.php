<?php

namespace Tangyuan\Meme\Api;

use Flarum\Http\RequestUtil;
use Flarum\Settings\SettingsRepositoryInterface;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Message\UploadedFileInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Tangyuan\Meme\Model\Meme;
use Tangyuan\Meme\Service\MemeStorage;

class MemeUploadController implements RequestHandlerInterface
{
    use JsonResponder;

    public function __construct(
        private MemeStorage $storage,
        private SettingsRepositoryInterface $settings,
    ) {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        if (!$actor->exists) {
            return $this->jsonResponse(['error' => 'Unauthorized'], 401);
        }

        $target = (string) ($request->getParsedBody()['target'] ?? 'user');

        if ($target === 'official') {
            if (!$actor->hasPermission('tangyuan-meme.manageOfficialMemes')) {
                return $this->jsonResponse(['error' => 'Forbidden'], 403);
            }
        } else {
            if (!(bool) $this->settings->get('tangyuan-meme.allowUserUploads', false)) {
                return $this->jsonResponse(['error' => 'User uploads are disabled'], 403);
            }
            if (!$actor->hasPermission('tangyuan-meme.uploadMeme')) {
                return $this->jsonResponse(['error' => 'Forbidden'], 403);
            }
        }

        $files = $request->getUploadedFiles();
        $inputFiles = $this->flattenFiles($files);
        if (empty($inputFiles)) {
            return $this->jsonResponse(['error' => 'No files'], 400);
        }

        $maxCount = (int) $this->settings->get('tangyuan-meme.maxUploadsPerUser', 100);
        $maxSize = (int) $this->settings->get('tangyuan-meme.maxTotalSizePerUser', 10 * 1024 * 1024);
        $formatsRegex = (string) $this->settings->get('tangyuan-meme.allowedFormatsRegex', '/\.(png|jpe?g|gif|webp)$/i');
        $moderationEnabled = (bool) $this->settings->get('tangyuan-meme.enableModeration', true);

        $defaultStatus = $target === 'official' ? Meme::STATUS_APPROVED : ($moderationEnabled ? Meme::STATUS_PENDING : Meme::STATUS_APPROVED);

        $usedCount = 0;
        $usedSize = 0;
        if ($target === 'user') {
            $usedCount = Meme::where('uploader_id', $actor->id)
                ->whereIn('status', [Meme::STATUS_APPROVED, Meme::STATUS_PENDING])
                ->count();
            $usedSize = (int) Meme::where('uploader_id', $actor->id)
                ->whereIn('status', [Meme::STATUS_APPROVED, Meme::STATUS_PENDING])
                ->sum('size');
        }

        $created = [];
        $errors = [];

        foreach ($inputFiles as $file) {
            if (!$file instanceof UploadedFileInterface) {
                $errors[] = ['filename' => null, 'error' => 'invalid'];
                continue;
            }
            if ($file->getError() !== UPLOAD_ERR_OK) {
                $errors[] = ['filename' => $file->getClientFilename(), 'error' => 'upload_error_' . $file->getError()];
                continue;
            }

            $originalName = (string) $file->getClientFilename();
            if (!preg_match($formatsRegex, $originalName)) {
                $errors[] = ['filename' => $originalName, 'error' => 'format_not_allowed'];
                continue;
            }

            $size = (int) $file->getSize();
            if ($size <= 0) {
                $errors[] = ['filename' => $originalName, 'error' => 'empty_file'];
                continue;
            }

            if ($target === 'user') {
                if ($usedCount + 1 > $maxCount) {
                    $errors[] = ['filename' => $originalName, 'error' => 'quota_count_exceeded'];
                    continue;
                }
                if ($usedSize + $size > $maxSize) {
                    $errors[] = ['filename' => $originalName, 'error' => 'quota_size_exceeded'];
                    continue;
                }
            }

            $uploaderId = $target === 'user' ? (int) $actor->id : null;

            if ($target === 'official') {
                $dir = $this->storage->getOfficialStorageDir();
                $this->storage->ensureDir($dir);
                $cleaned = $this->sanitizeOfficialName($originalName);
                $counter = 1;
                $filename = $cleaned;
                while (file_exists($dir . '/' . $filename)) {
                    $parts = pathinfo($cleaned);
                    $filename = ($parts['filename'] ?? 'meme') . '_' . $counter . '.' . ($parts['extension'] ?? 'webp');
                    $counter++;
                }
                $dest = $dir . '/' . $filename;
            } else {
                $filename = $this->storage->buildUniqueFilename($uploaderId, $originalName, $actor->username);
                $dest = $this->storage->getUserStorageDir($uploaderId) . '/' . $filename;
            }

            try {
                $file->moveTo($dest);
            } catch (\Throwable $e) {
                $errors[] = ['filename' => $originalName, 'error' => 'write_failed'];
                continue;
            }

            $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
            $mime = [
                'png' => 'image/png',
                'jpg' => 'image/jpeg',
                'jpeg' => 'image/jpeg',
                'gif' => 'image/gif',
                'webp' => 'image/webp',
            ][$ext] ?? 'application/octet-stream';

            $meme = new Meme();
            $meme->type = $target === 'official' ? Meme::TYPE_OFFICIAL : Meme::TYPE_USER;
            $meme->uploader_id = $uploaderId;
            $meme->filename = $filename;
            $meme->original_filename = $originalName;
            $meme->display_name = mb_substr(pathinfo($originalName, PATHINFO_FILENAME), 0, 191);
            $meme->status = $defaultStatus;
            $meme->size = $size;
            $meme->mime = $mime;
            $meme->save();

            // Cache immediately so the URL works right away
            $this->storage->ensureCached($meme);

            if ($target === 'user') {
                $usedCount++;
                $usedSize += $size;
            }

            $created[] = [
                'id' => (int) $meme->id,
                'filename' => $meme->filename,
                'display_name' => $meme->display_name,
                'status' => $meme->status,
                'size' => (int) $meme->size,
            ];
        }

        return $this->jsonResponse([
            'created' => $created,
            'errors' => $errors,
        ]);
    }

    private function flattenFiles(array $files): array
    {
        $out = [];
        foreach ($files as $key => $value) {
            if (is_array($value)) {
                foreach ($value as $v) {
                    if ($v instanceof UploadedFileInterface) {
                        $out[] = $v;
                    }
                }
            } elseif ($value instanceof UploadedFileInterface) {
                $out[] = $value;
            }
        }
        return $out;
    }

    private function sanitizeOfficialName(string $name): string
    {
        $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
        $base = pathinfo($name, PATHINFO_FILENAME);
        $base = preg_replace('/[^\p{L}\p{N}_\-]/u', '_', $base) ?: 'meme';
        $base = mb_substr($base, 0, 96);
        return $base . '.' . $ext;
    }
}
