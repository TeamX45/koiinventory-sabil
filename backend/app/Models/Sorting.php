<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Sorting extends Model
{
    use HasFactory;

    protected $fillable = [
        'code', 'source_batch_id', 'sorting_date',
        'total_sorted', 'total_loss', 'status', 'notes', 'created_by',
    ];

    protected $casts = [
        'sorting_date' => 'date',
    ];

    public function sourceBatch(): BelongsTo
    {
        return $this->belongsTo(Batch::class, 'source_batch_id');
    }

    public function results(): HasMany
    {
        return $this->hasMany(SortingResult::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
