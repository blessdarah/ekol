<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Class names join the letter to the level number: "Form 1 A" becomes
 * "Form 1A". Levels named in words ("Lower Sixth A") keep the space.
 */
return new class extends Migration
{
    public function up(): void
    {
        $this->rename('/(\d)\s+(\p{Lu})$/u', '$1$2');
    }

    public function down(): void
    {
        $this->rename('/(\d)(\p{Lu})$/u', '$1 $2');
    }

    protected function rename(string $pattern, string $replacement): void
    {
        DB::table('school_classes')->select(['id', 'name'])->orderBy('id')->chunk(500, function ($classes) use ($pattern, $replacement) {
            foreach ($classes as $class) {
                $name = preg_replace($pattern, $replacement, (string) $class->name);

                if ($name !== null && $name !== $class->name) {
                    DB::table('school_classes')->where('id', $class->id)->update(['name' => $name]);
                }
            }
        });
    }
};
