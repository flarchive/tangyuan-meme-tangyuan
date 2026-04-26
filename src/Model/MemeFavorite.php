<?php

namespace Tangyuan\Meme\Model;

use Flarum\Database\AbstractModel;
use Flarum\User\User;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $user_id
 * @property int $meme_id
 * @property bool $is_favorite
 * @property string|null $custom_name
 */
class MemeFavorite extends AbstractModel
{
    protected $table = 'meme_user_favorites';

    protected $fillable = ['user_id', 'meme_id', 'is_favorite', 'custom_name'];

    protected $casts = [
        'is_favorite' => 'boolean',
        'user_id' => 'integer',
        'meme_id' => 'integer',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function meme(): BelongsTo
    {
        return $this->belongsTo(Meme::class, 'meme_id');
    }
}
