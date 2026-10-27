<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('is_platform_admin')->default(false);
            $table->timestampTz('last_signed_in_at')->nullable();
        });
        Schema::table('schools', function (Blueprint $table) {
            $table->boolean('is_demo')->default(false)->index();
            $table->timestampTz('demo_expires_at')->nullable();
            $table->timestampTz('suspended_at')->nullable();
        });
        Schema::table('demo_requests', function (Blueprint $table) {
            $table->string('contact_name')->nullable();
            $table->string('email')->nullable();
            $table->string('status')->default('new')->index();
            $table->foreignUuid('demo_school_id')->nullable()->constrained('schools')->nullOnDelete();
            $table->foreignUuid('demo_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignUuid('converted_school_id')->nullable()->constrained('schools')->nullOnDelete();
            $table->timestampTz('extended_at')->nullable();
        });
        Schema::create('school_visits', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('school_id')->constrained('schools')->cascadeOnDelete();
            $table->foreignUuid('user_id')->constrained('users');
            $table->timestampTz('started_at');
            $table->timestampTz('expires_at')->index();
            $table->timestampTz('ended_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('school_visits');
        Schema::table('demo_requests', function (Blueprint $table) {
            $table->dropConstrainedForeignId('demo_school_id');
            $table->dropConstrainedForeignId('demo_user_id');
            $table->dropConstrainedForeignId('converted_school_id');
            $table->dropColumn(['contact_name', 'email', 'status', 'extended_at']);
        });
        Schema::table('schools', fn (Blueprint $table) => $table->dropColumn(['is_demo', 'demo_expires_at', 'suspended_at']));
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn(['is_platform_admin', 'last_signed_in_at']));
    }
};
