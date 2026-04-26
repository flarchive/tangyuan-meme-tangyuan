<?php

use Flarum\Database\Migration;
use Illuminate\Database\Schema\Blueprint;

return Migration::createTable('meme_tab_pins', function (Blueprint $table) {
    $table->id();
    $table->unsignedInteger('user_id');
    $table->unsignedInteger('pinned_uploader_id');
    $table->unsignedSmallInteger('position')->default(0);
    $table->timestamps();

    $table->unique(['user_id', 'pinned_uploader_id'], 'meme_tab_pins_unique');
    $table->index(['user_id', 'position'], 'meme_tab_pins_user_position');
    $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
    $table->foreign('pinned_uploader_id')->references('id')->on('users')->cascadeOnDelete();
});
