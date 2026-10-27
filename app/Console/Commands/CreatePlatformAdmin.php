<?php

namespace App\Console\Commands;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Password;

class CreatePlatformAdmin extends Command
{
    protected $signature = 'platform:admin {email} {--name=}';

    protected $description = 'Create a platform-only administrator with a password entered securely';

    public function handle(): int
    {
        if (! $this->input->isInteractive()) {
            $this->error('Run interactively to enter the password securely.');

            return self::FAILURE;
        }
        $data = ['email' => strtolower((string) $this->argument('email')), 'name' => $this->option('name') ?: $this->ask('Full name'), 'password' => $this->secret('Password')];
        $validator = Validator::make($data, ['email' => ['required', 'email', 'unique:users,email'], 'name' => ['required', 'string', 'max:150'], 'password' => ['required', Password::min(12)->mixedCase()->numbers()]]);
        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $message) {
                $this->error($message);
            }

            return self::FAILURE;
        }
        $user = new User;
        $user->forceFill(['email' => $data['email'], 'full_name' => $data['name'], 'password' => $data['password'],
            'school_id' => null, 'is_platform_admin' => true, 'staff_code' => 'PLATFORM', 'initials' => mb_strtoupper(mb_substr($data['name'], 0, 2)), 'phone' => '', 'role' => UserRole::Admin])->save();
        $this->info('Platform administrator created. Every sign-in also requires an emailed code.');

        return self::SUCCESS;
    }
}
