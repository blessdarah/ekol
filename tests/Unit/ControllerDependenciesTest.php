<?php

$directory = __DIR__.'/../../app/Http/Controllers';
$controllers = [];

foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($directory, FilesystemIterator::SKIP_DOTS)) as $file) {
    if (! $file->isFile() || ! str_ends_with($file->getFilename(), 'Controller.php') || $file->getFilename() === 'Controller.php') {
        continue;
    }

    $relative = substr($file->getPathname(), strlen($directory) + 1, -4);
    $controllers[] = 'App\\Http\\Controllers\\'.str_replace(DIRECTORY_SEPARATOR, '\\', $relative);
}

arch('controllers do not depend on other controllers')
    ->expect('App\Http\Controllers')
    ->not->toUse($controllers);

arch('models requests and middleware do not depend on controllers')
    ->expect(['App\Models', 'App\Http\Requests', 'App\Http\Middleware'])
    ->not->toUse('App\Http\Controllers');

arch('workflow actions do not depend on HTTP infrastructure')
    ->expect('App\Actions')
    ->not->toUse(['App\Http', 'Illuminate\Http', 'Inertia']);

test('controllers stay within four hundred lines', function () use ($directory) {
    $oversized = [];
    foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($directory, FilesystemIterator::SKIP_DOTS)) as $file) {
        if ($file->isFile() && str_ends_with($file->getFilename(), 'Controller.php')) {
            $lines = count(file($file->getPathname()) ?: []);
            if ($lines > 400) {
                $oversized[$file->getFilename()] = $lines;
            }
        }
    }
    expect($oversized)->toBe([]);
});
