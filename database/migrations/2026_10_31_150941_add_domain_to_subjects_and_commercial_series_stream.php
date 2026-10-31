<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('subjects', function (Blueprint $table): void {
            $table->string('domain', 20)->nullable();
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE subjects ADD CONSTRAINT subjects_domain_check CHECK (domain IS NULL OR domain IN ('general', 'science', 'arts', 'commercial'))");
            DB::statement('ALTER TABLE series DROP CONSTRAINT series_stream_check');
            DB::statement("ALTER TABLE series ADD CONSTRAINT series_stream_check CHECK (stream IS NULL OR stream IN ('science', 'arts', 'commercial'))");
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE series DROP CONSTRAINT series_stream_check');
            DB::statement("ALTER TABLE series ADD CONSTRAINT series_stream_check CHECK (stream IS NULL OR stream IN ('science', 'arts'))");
            DB::statement('ALTER TABLE subjects DROP CONSTRAINT subjects_domain_check');
        }

        Schema::table('subjects', function (Blueprint $table): void {
            $table->dropColumn('domain');
        });
    }
};
