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
        Schema::table('invoices', function (Blueprint $table): void {
            $table->bigInteger('due_minor')->nullable();
            $table->bigInteger('paid_minor')->nullable();
            $table->bigInteger('balance_minor')->nullable();
            $table->bigInteger('overdue_minor')->nullable();
            $table->date('ledger_updated_on')->nullable();
            $table->index(['school_id', 'term_id']);
        });
        Schema::table('installments', function (Blueprint $table): void {
            $table->bigInteger('net_due_minor')->nullable();
        });
        Schema::table('attendance', function (Blueprint $table): void {
            $table->index('date');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('attendance', function (Blueprint $table): void {
            $table->dropIndex(['date']);
        });
        Schema::table('installments', function (Blueprint $table): void {
            $table->dropColumn('net_due_minor');
        });
        Schema::table('invoices', function (Blueprint $table): void {
            $table->dropIndex(['school_id', 'term_id']);
            $table->dropColumn(['due_minor', 'paid_minor', 'balance_minor', 'overdue_minor', 'ledger_updated_on']);
        });
    }
};
