<?php

namespace Tangyuan\Meme\Model;

use Flarum\Database\AbstractModel;
use Flarum\User\User;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $meme_id
 * @property int $user_id
 */
class MemeVisibilityUser extends AbstractModel
{
    protected $table = 'meme_visibility_users';

    protected $fillable = ['meme_id', 'user_id'];

    protected $casts = [
        'meme_id' => 'integer',
        'user_id' => 'integer',
    ];

    public function meme(): BelongsTo
    {
        return $this->belongsTo(Meme::class, 'meme_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
