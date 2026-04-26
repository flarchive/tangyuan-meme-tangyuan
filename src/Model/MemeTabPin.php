<?php

namespace Tangyuan\Meme\Model;

use Flarum\Database\AbstractModel;
use Flarum\User\User;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $user_id
 * @property int $pinned_uploader_id
 * @property int $position
 */
class MemeTabPin extends AbstractModel
{
    protected $table = 'meme_tab_pins';

    protected $fillable = ['user_id', 'pinned_uploader_id', 'position'];

    protected $casts = [
        'user_id' => 'integer',
        'pinned_uploader_id' => 'integer',
        'position' => 'integer',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function pinnedUploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'pinned_uploader_id');
    }
}
