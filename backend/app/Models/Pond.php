<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Pond extends Model
{
    use HasFactory;

    protected $fillable = [
        'location_id', 'pond_category_id', 'code', 'name',
        'capacity', 'target_min_size_cm', 'target_max_size_cm',
        'grow_duration_months', 'is_active', 'notes',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(PondCategory::class, 'pond_category_id');
    }

    public function batches(): HasMany
    {
        return $this->hasMany(Batch::class);
    }

    public function activeBatches(): HasMany
    {
        return $this->hasMany(Batch::class)->where('status', 'active');
    }

    public function getCurrentStockAttribute(): int
    {
        return (int) $this->activeBatches()->sum('current_count');
    }
}
