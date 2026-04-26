<?php

use Flarum\Database\Migration;
use Illuminate\Database\Schema\Blueprint;

return Migration::createTable('meme_visibility_users', function (Blueprint $table) {
    $table->id();
    $table->unsignedBigInteger('meme_id');
    $table->unsignedInteger('user_id');
    $table->timestamps();

    $table->unique(['meme_id', 'user_id'], 'meme_visibility_unique');
    $table->index('user_id', 'meme_visibility_user');
    $table->foreign('meme_id')->references('id')->on('meme_items')->onDelete('cascade');
    $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
});
