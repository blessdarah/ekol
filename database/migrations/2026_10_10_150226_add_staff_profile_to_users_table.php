<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('given_name')->nullable();
            $table->string('family_name')->nullable();
            $table->string('gender')->nullable();
            $table->string('address')->nullable();
            $table->string('qualification')->nullable();
            $table->string('employment_type')->nullable();
            $table->string('photo_path')->nullable();
            $table->date('joined_on')->nullable();

            $table->smallInteger('teaching_days')->nullable();
            $table->smallInteger('max_periods_week')->nullable();
            $table->smallInteger('max_periods_day')->nullable();
            $table->jsonb('unavailable_times')->nullable();

            $table->string('invitation_token_hash', 64)->nullable()->unique();
            $table->string('invitation_channel')->nullable();
            $table->timestampTz('invitation_expires_at')->nullable();

            // A staff member exists on the roster before she has an account.
            $table->string('password')->nullable()->change();
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE users DROP CONSTRAINT users_role_check');
            DB::statement("ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('principal', 'academic_lead', 'teacher', 'form_master', 'admin', 'accountant', 'head_of_department', 'registrar', 'bursar'))");
            DB::statement("ALTER TABLE users ADD CONSTRAINT users_gender_check CHECK (gender IS NULL OR gender IN ('male', 'female'))");
            DB::statement("ALTER TABLE users ADD CONSTRAINT users_employment_type_check CHECK (employment_type IS NULL OR employment_type IN ('school_paid', 'government'))");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE users DROP CONSTRAINT users_employment_type_check');
            DB::statement('ALTER TABLE users DROP CONSTRAINT users_gender_check');
            DB::statement('ALTER TABLE users DROP CONSTRAINT users_role_check');
            DB::statement("ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('principal', 'academic_lead', 'teacher', 'form_master', 'admin', 'accountant'))");
        }

        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['invitation_token_hash']);
            $table->dropColumn([
                'given_name', 'family_name', 'gender', 'address', 'qualification',
                'employment_type', 'photo_path', 'joined_on', 'teaching_days',
                'max_periods_week', 'max_periods_day', 'unavailable_times',
                'invitation_token_hash', 'invitation_channel', 'invitation_expires_at',
            ]);
        });
    }
};
