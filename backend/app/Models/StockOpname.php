<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockOpname extends Model
{
    use HasFactory;

    protected $table = 'stock_opnames';

    protected $fillable = [
        'code',
        'batch_id',
        // Diisi saat baris opname adalah temuan fisik: ikan yang ada di kolam
        // tapi belum tercatat. Batch-nya dibuat saat opname diselesaikan.
        'pond_id',
        'fish_type_id',
        'grade_id',
        'size_cm',
        'price_per_fish',
        'opname_date',
        'system_count',
        'actual_count',
        'difference',
        'status',
        'notes',
        'created_by',
    ];

    protected $casts = [
        'opname_date'  => 'date',
        'system_count' => 'integer',
        'actual_count' => 'integer',
        'difference'   => 'integer',
        'size_cm'      => 'integer',
    ];

    /** Baris ini menambah stok baru, bukan mengoreksi yang sudah ada. */
    public function isNewStock(): bool
    {
        return $this->batch_id === null;
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(Batch::class);
    }

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

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
