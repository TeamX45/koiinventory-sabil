<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Batch extends Model
{
    use HasFactory;

    protected $fillable = [
        'code', 'source_type', 'source_id', 'parent_batch_id',
        'pond_id', 'fish_type_id', 'grade_id',
        'initial_count', 'current_count', 'size_cm', 'size_max_cm', 'price_per_fish',
        'entry_date', 'status', 'notes',
    ];

    protected $casts = [
        'entry_date' => 'date',
        'price_per_fish' => 'decimal:2',
        'size_cm' => 'integer',
        'size_max_cm' => 'integer',
    ];

    public function pond(): BelongsTo
    {
        return $this->belongsTo(Pond::class);
    }

    public function fishType(): BelongsTo
    {
        return $this->belongsTo(FishType::class);
    }

    public function grade(): BelongsTo
    {
        return $this->belongsTo(Grade::class);
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(Batch::class, 'parent_batch_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(Batch::class, 'parent_batch_id');
    }

    public function movements(): HasMany
    {
        return $this->hasMany(StockMovement::class);
    }

    public function source()
    {
        return match ($this->source_type) {
            'purchase' => Purchase::find($this->source_id),
            'harvest'  => Harvest::find($this->source_id),
            'sorting'  => Sorting::find($this->source_id),
            default    => null,
        };
    }

    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }
}
