<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Option A merge: ERD `staff` lives on Laravel `users`. Single auth
     * table with tenant scope, staff code, and role for future permissions.
     */
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('school_id')->nullable();
            $table->foreign('school_id')->references('id')->on('schools')->nullOnDelete();
            $table->string('staff_code');
            $table->string('full_name');
            $table->char('initials', 2);
            $table->string('email')->unique();
            $table->string('role')->default('teacher');
            $table->string('phone');
            $table->boolean('is_form_master')->default(false);
            $table->timestamptz('invited_at')->nullable();
            $table->timestamptz('setup_completed_at')->nullable();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password');
            $table->rememberToken();
            $table->timestampsTz();
            $table->softDeletesTz();

            $table->unique(['school_id', 'staff_code']);
            $table->unique(['school_id', 'phone']);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('principal', 'academic_lead', 'teacher', 'form_master', 'admin', 'accountant'))");
        }

        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('pending_registrations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->jsonb('school_payload');
            $table->jsonb('admin_payload');
            $table->string('code_hash', 64);
            $table->string('channel')->default('email');
            $table->smallInteger('attempts')->default(0);
            $table->timestamptz('expires_at');
            $table->timestamptz('consumed_at')->nullable();
            $table->timestamptz('created_at')->useCurrent();
        });

        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->uuid('user_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('sessions');
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('pending_registrations');
        Schema::dropIfExists('users');
    }
};
