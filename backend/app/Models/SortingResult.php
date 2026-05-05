<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SortingResult extends Model
{
    use HasFactory;

    protected $fillable = [
        'sorting_id', 'grade_id', 'target_pond_id', 'fish_type_id',
        'target_batch_id', 'count', 'price_per_fish', 'notes',
    ];

    protected $casts = [
        'price_per_fish' => 'decimal:2',
    ];

    public function sorting(): BelongsTo
    {
        return $this->belongsTo(Sorting::class);
    }

    public function grade(): BelongsTo
    {
        return $this->belongsTo(Grade::class);
    }

    public function targetPond(): BelongsTo
    {
        return $this->belongsTo(Pond::class, 'target_pond_id');
    }

    public function fishType(): BelongsTo
    {
        return $this->belongsTo(FishType::class);
    }

    public function targetBatch(): BelongsTo
    {
        return $this->belongsTo(Batch::class, 'target_batch_id');
    }
}
