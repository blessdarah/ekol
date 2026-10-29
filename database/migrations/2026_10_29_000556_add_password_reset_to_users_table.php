<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A password reset in progress for one staff account in one school: the
 * hashed link token, or the hashed SMS code and the tries left on it.
 * Kept on the account because the same email can belong to staff in
 * several schools, so a reset is never keyed by email alone.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('password_reset_token_hash', 64)->nullable()->index();
            $table->string('password_reset_code_hash', 64)->nullable();
            $table->unsignedTinyInteger('password_reset_attempts')->default(0);
            $table->timestampTz('password_reset_expires_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['password_reset_token_hash']);
            $table->dropColumn(['password_reset_token_hash', 'password_reset_code_hash', 'password_reset_attempts', 'password_reset_expires_at']);
        });
    }
};
