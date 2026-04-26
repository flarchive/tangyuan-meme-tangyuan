<?php

namespace Tangyuan\Meme\Api\Serializer;

use Flarum\Api\Serializer\AbstractSerializer;
use Tangyuan\Meme\Model\Meme;

class MemeSerializer extends AbstractSerializer
{
    protected $type = 'memes';

    protected function getDefaultAttributes($meme): array
    {
        /** @var Meme $meme */
        return [
            'id' => (int) $meme->id,
            'type' => $meme->type,
            'filename' => $meme->filename,
            'displayName' => $meme->display_name,
            'status' => $meme->status,
            'rejectionReason' => $meme->rejection_reason,
            'size' => (int) $meme->size,
            'mime' => $meme->mime,
            'createdAt' => $this->formatDate($meme->created_at),
        ];
    }
}
