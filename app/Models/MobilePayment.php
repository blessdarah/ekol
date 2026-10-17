<?php

namespace App\Models;

use App\Enums\PaymentMethod;
use App\Models\Concerns\BelongsToSchool;
use BlessDarah\PhpCampay\Campay;
use BlessDarah\PhpCampay\Exceptions\CampayException;
use GuzzleHttp\Exception\BadResponseException;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * A parent paying school fees from their phone through Campay. It is a
 * request until the operator answers: only a successful one becomes a
 * payment on the invoice, with its receipt.
 *
 * @property string $id
 * @property string $school_id
 * @property string $student_id
 * @property string $invoice_id
 * @property string $amount
 * @property string $phone
 * @property string|null $operator
 * @property string|null $reference
 * @property string $status
 * @property string|null $failure_reason
 * @property string|null $payment_id
 * @property Carbon|null $checked_at
 * @property Carbon|null $settled_at
 * @property Carbon $created_at
 */
class MobilePayment extends Model
{
    use BelongsToSchool, HasUuids;

    public const string PENDING = 'pending';

    public const string SUCCESSFUL = 'successful';

    public const string FAILED = 'failed';

    /**
     * How long the parent is shown the prompt before being told it was
     * not approved. The request itself stays open a little longer.
     */
    public const int APPROVAL_SECONDS = 120;

    /**
     * A request with no answer after this long is closed as failed.
     */
    public const int GIVE_UP_MINUTES = 10;

    protected $fillable = [
        'school_id',
        'student_id',
        'invoice_id',
        'amount',
        'phone',
        'operator',
        'reference',
        'status',
        'failure_reason',
        'payment_id',
        'checked_at',
        'settled_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'checked_at' => 'datetime',
            'settled_at' => 'datetime',
        ];
    }

    /**
     * The network a Cameroonian number belongs to, from its first digits,
     * or null when it is not a mobile money number.
     */
    public static function operatorFor(string $phone): ?string
    {
        $digits = static::localDigits($phone);

        return match (true) {
            preg_match('/^6(7\d|8[0-4]|5[0-4])\d{6}$/', $digits) === 1 => 'MTN',
            preg_match('/^6(9\d|5[5-9])\d{6}$/', $digits) === 1 => 'Orange',
            default => null,
        };
    }

    /**
     * The nine digits of a Cameroonian number, without +237 or spaces.
     */
    public static function localDigits(string $phone): string
    {
        $digits = (string) preg_replace('/\D/', '', $phone);

        return strlen($digits) > 9 ? substr($digits, -9) : $digits;
    }

    /**
     * Ask Campay to send the payment prompt to the parent's phone. A
     * request Campay refuses is kept as failed, so the parent sees why.
     */
    public static function start(Invoice $invoice, Student $student, int $amount, string $phone, Campay $campay): self
    {
        $digits = static::localDigits($phone);
        $request = static::create([
            'school_id' => $student->school_id,
            'student_id' => $student->id,
            'invoice_id' => $invoice->id,
            'amount' => number_format($amount, 2, '.', ''),
            'phone' => $digits,
            'operator' => static::operatorFor($digits),
            'status' => static::PENDING,
        ]);

        try {
            $answer = static::decode($campay->collect([
                'amount' => (string) $amount,
                'currency' => 'XAF',
                'from' => '237'.$digits,
                'description' => mb_substr("School fees - {$student->full_name}", 0, 100),
                'external_reference' => $request->id,
            ]));
            $reference = is_string($answer['reference'] ?? null) ? $answer['reference'] : null;

            $request->update($reference === null
                ? ['status' => static::FAILED, 'failure_reason' => 'unreachable']
                : ['reference' => $reference, 'checked_at' => now()]);
        } catch (CampayException $exception) {
            $said = static::campaySaid($exception);
            Log::warning('Campay collection request failed.', ['mobile_payment' => $request->id, 'error' => $exception->getMessage(), 'campay' => $said]);
            $request->update([
                'status' => static::FAILED,
                'failure_reason' => $exception->getCode() >= 400 && $exception->getCode() < 500 ? 'rejected' : 'unreachable',
            ]);
        }

        return $request;
    }

    /**
     * Ask Campay how the request stands. A successful one is recorded on
     * the invoice once, however often this runs.
     *
     * @phpstan-impure
     */
    public function refreshStatus(Campay $campay): self
    {
        if ($this->status !== static::PENDING) {
            return $this;
        }

        if ($this->reference === null) {
            return $this->fail('unreachable');
        }

        try {
            $answer = static::decode($campay->getTransactionStatus($this->reference));
        } catch (CampayException $exception) {
            Log::warning('Campay status check failed.', ['mobile_payment' => $this->id, 'error' => $exception->getMessage(), 'campay' => static::campaySaid($exception)]);

            return $this->tooOld() ? $this->fail('timeout') : tap($this)->update(['checked_at' => now()]);
        }

        return match (strtoupper((string) ($answer['status'] ?? ''))) {
            'SUCCESSFUL' => $this->settle($answer),
            'FAILED' => $this->fail(static::reasonFrom($answer)),
            default => $this->tooOld() ? $this->fail('timeout') : tap($this)->update(['checked_at' => now()]),
        };
    }

    /**
     * Whether the parent should still be waiting for the prompt.
     */
    public function awaitingApproval(): bool
    {
        return $this->status === static::PENDING
            && $this->created_at->diffInSeconds(now()) < static::APPROVAL_SECONDS;
    }

    public function tooOld(): bool
    {
        return $this->created_at->lt(now()->subMinutes(static::GIVE_UP_MINUTES));
    }

    /**
     * @param  array<string, mixed>  $answer
     */
    protected function settle(array $answer): self
    {
        DB::transaction(function () use ($answer) {
            $fresh = static::whereKey($this->id)->lockForUpdate()->firstOrFail();

            if ($fresh->payment_id !== null || $fresh->status !== static::PENDING) {
                return;
            }

            $invoice = Invoice::whereKey($fresh->invoice_id)->firstOrFail();
            $operatorReference = $answer['operator_reference'] ?? null;
            $payment = $invoice->recordPayment(
                $fresh->amount,
                PaymentMethod::MobileMoney,
                null,
                null,
                is_string($operatorReference) && $operatorReference !== '' ? $operatorReference : $fresh->reference,
                now(),
            );

            $fresh->update([
                'status' => static::SUCCESSFUL,
                'payment_id' => $payment->id,
                'operator' => is_string($answer['operator'] ?? null) ? $answer['operator'] : $fresh->operator,
                'settled_at' => now(),
                'checked_at' => now(),
            ]);
        });

        return $this->refresh();
    }

    protected function fail(string $reason): self
    {
        $this->update(['status' => static::FAILED, 'failure_reason' => $reason, 'checked_at' => now()]);

        return $this;
    }

    /**
     * What Campay answered when it refused a request, for the log.
     */
    protected static function campaySaid(CampayException $exception): ?string
    {
        $previous = $exception->getPrevious();

        return $previous instanceof BadResponseException
            ? mb_substr((string) $previous->getResponse()->getBody(), 0, 1000)
            : null;
    }

    /**
     * @param  array<string, mixed>  $answer
     */
    protected static function reasonFrom(array $answer): string
    {
        $said = strtolower((string) ($answer['reason'] ?? $answer['message'] ?? ''));

        return match (true) {
            str_contains($said, 'insufficient') || str_contains($said, 'balance') => 'insufficient',
            str_contains($said, 'timeout') || str_contains($said, 'expired') => 'timeout',
            default => 'declined',
        };
    }

    /**
     * @return array<string, mixed>
     */
    protected static function decode(string $body): array
    {
        $data = json_decode($body, true);

        return is_array($data) ? $data : [];
    }

    /**
     * @return BelongsTo<Student, $this>
     */
    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    /**
     * @return BelongsTo<Invoice, $this>
     */
    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    /**
     * @return BelongsTo<Payment, $this>
     */
    public function payment(): BelongsTo
    {
        return $this->belongsTo(Payment::class);
    }
}
