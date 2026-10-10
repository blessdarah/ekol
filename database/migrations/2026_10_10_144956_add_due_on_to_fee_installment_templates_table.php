<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('fee_installment_templates', function (Blueprint $table) {
            $table->date('due_on')->nullable()->after('percent');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('fee_installment_templates', function (Blueprint $table) {
            $table->dropColumn('due_on');
        });
    }
};
