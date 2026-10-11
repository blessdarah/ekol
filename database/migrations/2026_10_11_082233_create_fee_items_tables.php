<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('fee_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('school_id')->constrained('schools')->cascadeOnDelete();
            $table->foreignUuid('academic_year_id')->constrained('academic_years')->cascadeOnDelete();
            $table->string('name');
            $table->smallInteger('position');
            $table->boolean('is_spread')->default(true);
            $table->boolean('new_students_only')->default(false);
            $table->timestampsTz();

        });

        Schema::create('fee_item_amounts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('fee_item_id')->constrained('fee_items')->cascadeOnDelete();
            $table->foreignUuid('level_id')->constrained('levels')->cascadeOnDelete();
            $table->decimal('amount', 10, 2);
            $table->timestampsTz();

            $table->unique(['fee_item_id', 'level_id']);
        });

        Schema::create('invoice_lines', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('invoice_id')->constrained('invoices')->cascadeOnDelete();
            $table->foreignUuid('fee_item_id')->nullable()->constrained('fee_items')->nullOnDelete();
            $table->string('name');
            $table->smallInteger('position');
            $table->boolean('is_spread')->default(true);
            $table->decimal('amount', 10, 2);
            $table->timestampsTz();
        });

        $this->carryOver();
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('invoice_lines');
        Schema::dropIfExists('fee_item_amounts');
        Schema::dropIfExists('fee_items');
    }

    /**
     * Until now a level had one annual fee. Keep it as a "School fees"
     * item for each year, and give every invoice already issued the
     * one line it was billed for.
     */
    protected function carryOver(): void
    {
        $now = now();
        $items = [];

        foreach (DB::table('fee_plans')->orderBy('created_at')->get() as $plan) {
            $key = $plan->school_id.'|'.$plan->academic_year_id;

            if (! isset($items[$key])) {
                $items[$key] = (string) Str::uuid7();

                DB::table('fee_items')->insert([
                    'id' => $items[$key],
                    'school_id' => $plan->school_id,
                    'academic_year_id' => $plan->academic_year_id,
                    'name' => 'School fees',
                    'position' => 1,
                    'is_spread' => true,
                    'new_students_only' => false,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            DB::table('fee_item_amounts')->insert([
                'id' => (string) Str::uuid7(),
                'fee_item_id' => $items[$key],
                'level_id' => $plan->level_id,
                'amount' => $plan->annual_amount,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        $invoices = DB::table('invoices')
            ->join('fee_plans', 'fee_plans.id', '=', 'invoices.fee_plan_id')
            ->select('invoices.id', 'invoices.amount_due', 'fee_plans.school_id', 'fee_plans.academic_year_id')
            ->get();

        foreach ($invoices as $invoice) {
            DB::table('invoice_lines')->insert([
                'id' => (string) Str::uuid7(),
                'invoice_id' => $invoice->id,
                'fee_item_id' => $items[$invoice->school_id.'|'.$invoice->academic_year_id] ?? null,
                'name' => 'School fees',
                'position' => 1,
                'is_spread' => true,
                'amount' => $invoice->amount_due,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }
};
