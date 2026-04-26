<?php

use Flarum\Database\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

return [
    'up' => function (Builder $schema) {
        if ($schema->hasTable('meme_favorites')) {
            $schema->drop('meme_favorites');
        }

        $schema->create('meme_user_favorites', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('user_id');
            $table->unsignedBigInteger('meme_id');
            $table->boolean('is_favorite')->default(false);
            $table->string('custom_name', 15)->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'meme_id']);
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('meme_id')->references('id')->on('meme_items')->cascadeOnDelete();
        });
    },
    'down' => function (Builder $schema) {
        if ($schema->hasTable('meme_user_favorites')) {
            $schema->drop('meme_user_favorites');
        }
    },
];
