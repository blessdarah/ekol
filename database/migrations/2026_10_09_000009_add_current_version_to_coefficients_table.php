<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Second pass for the circular reference: coefficients exists before
     * coefficient_versions, so the live-row pointer is attached here.
     */
    public function up(): void
    {
        Schema::table('coefficients', function (Blueprint $table) {
            $table->foreign('current_version_id')->references('id')->on('coefficient_versions')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('coefficients', function (Blueprint $table) {
            $table->dropForeign(['current_version_id']);
        });
    }
};
