<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockMovement extends Model
{
    use HasFactory;

    protected $fillable = [
        'batch_id', 'type', 'from_pond_id', 'to_pond_id',
        'count', 'reference_type', 'reference_id',
        'movement_date', 'notes', 'created_by',
    ];

    protected $casts = [
        'movement_date' => 'date',
    ];

    public function batch(): BelongsTo
    {
        return $this->belongsTo(Batch::class);
    }

    public function fromPond(): BelongsTo
    {
        return $this->belongsTo(Pond::class, 'from_pond_id');
    }

    public function toPond(): BelongsTo
    {
        return $this->belongsTo(Pond::class, 'to_pond_id');
    }
}
