<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Invoices and payments carry their school, like every other tenant
 * table, so they are limited to the current school automatically
 * instead of only through the student they belong to.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->foreignUuid('school_id')->nullable()->after('id')->constrained()->cascadeOnDelete();
        });

        Schema::table('payments', function (Blueprint $table) {
            $table->foreignUuid('school_id')->nullable()->after('id')->constrained()->cascadeOnDelete();
        });

        DB::table('invoices')->update([
            'school_id' => DB::raw('(SELECT students.school_id FROM students WHERE students.id = invoices.student_id)'),
        ]);

        DB::table('payments')->update([
            'school_id' => DB::raw('(SELECT invoices.school_id FROM invoices WHERE invoices.id = payments.invoice_id)'),
        ]);
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropConstrainedForeignId('school_id');
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->dropConstrainedForeignId('school_id');
        });
    }
};
