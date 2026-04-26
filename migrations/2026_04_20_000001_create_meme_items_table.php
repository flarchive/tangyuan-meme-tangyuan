<?php

use Flarum\Database\Migration;
use Illuminate\Database\Schema\Blueprint;

return Migration::createTable('meme_items', function (Blueprint $table) {
    $table->id();
    $table->enum('type', ['official', 'user'])->default('user');
    $table->unsignedInteger('uploader_id')->nullable();
    $table->string('filename', 255);
    $table->string('original_filename', 255)->nullable();
    $table->string('display_name', 191)->nullable();
    $table->enum('status', ['approved', 'pending', 'rejected'])->default('approved');
    $table->text('rejection_reason')->nullable();
    $table->timestamp('rejected_at')->nullable();
    $table->unsignedBigInteger('size')->default(0);
    $table->string('mime', 64)->nullable();
    $table->timestamps();

    $table->unique(['type', 'uploader_id', 'filename'], 'meme_items_unique_location');
    $table->index(['type', 'status'], 'meme_items_type_status');
    $table->index(['uploader_id', 'status'], 'meme_items_uploader_status');
    $table->foreign('uploader_id')->references('id')->on('users')->nullOnDelete();
});
