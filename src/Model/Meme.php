<?php

namespace Tangyuan\Meme\Model;

use Flarum\Database\AbstractModel;
use Flarum\User\User;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property string $type 'official' | 'user'
 * @property int|null $uploader_id
 * @property string $filename
 * @property string|null $original_filename
 * @property string|null $display_name
 * @property string $status 'approved' | 'pending' | 'rejected'
 * @property string|null $rejection_reason
 * @property \Carbon\Carbon|null $rejected_at
 * @property int $size
 * @property string|null $mime
 * @property string $visibility 'public' | 'private'
 */
class Meme extends AbstractModel
{
    public const TYPE_OFFICIAL = 'official';
    public const TYPE_USER = 'user';

    public const STATUS_APPROVED = 'approved';
    public const STATUS_PENDING = 'pending';
    public const STATUS_REJECTED = 'rejected';

    public const VISIBILITY_PUBLIC = 'public';
    public const VISIBILITY_PRIVATE = 'private';

    protected $table = 'meme_items';

    protected $fillable = [
        'type',
        'uploader_id',
        'filename',
        'original_filename',
        'display_name',
        'status',
        'rejection_reason',
        'rejected_at',
        'size',
        'mime',
        'visibility',
    ];

    protected $casts = [
        'rejected_at' => 'datetime',
        'size' => 'integer',
        'uploader_id' => 'integer',
    ];

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploader_id');
    }

    public function favorites(): HasMany
    {
        return $this->hasMany(MemeFavorite::class, 'meme_id');
    }

    public function visibilityUsers(): HasMany
    {
        return $this->hasMany(MemeVisibilityUser::class, 'meme_id');
    }

    public function isOfficial(): bool
    {
        return $this->type === self::TYPE_OFFICIAL;
    }

    public function isApproved(): bool
    {
        return $this->status === self::STATUS_APPROVED;
    }

    public function isPending(): bool
    {
        return $this->status === self::STATUS_PENDING;
    }

    public function isRejected(): bool
    {
        return $this->status === self::STATUS_REJECTED;
    }

    public function isPublic(): bool
    {
        return ($this->visibility ?? self::VISIBILITY_PUBLIC) === self::VISIBILITY_PUBLIC;
    }

    public function scopeApproved($query)
    {
        return $query->where('status', self::STATUS_APPROVED);
    }

    public function scopePending($query)
    {
        return $query->where('status', self::STATUS_PENDING);
    }

    public function scopeRejected($query)
    {
        return $query->where('status', self::STATUS_REJECTED);
    }

    public function scopeOfficial($query)
    {
        return $query->where('type', self::TYPE_OFFICIAL);
    }

    public function scopeUserType($query)
    {
        return $query->where('type', self::TYPE_USER);
    }

    /**
     * Restrict to memes visible to the given user.
     * A meme is visible if: it's official, or it's public, or the user is the uploader,
     * or the user is explicitly allowed via meme_visibility_users.
     * Moderator bypass is handled at the controller level.
     */
    public function scopeVisibleTo($query, ?int $userId)
    {
        return $query->where(function ($q) use ($userId) {
            $q->where('type', self::TYPE_OFFICIAL)
              ->orWhere('visibility', self::VISIBILITY_PUBLIC)
              ->orWhereNull('visibility');

            if ($userId) {
                $q->orWhere('uploader_id', $userId)
                  ->orWhereIn('id', function ($sub) use ($userId) {
                      $sub->select('meme_id')
                          ->from('meme_visibility_users')
                          ->where('user_id', $userId);
                  });
            }
        });
    }
}
