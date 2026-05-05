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
    ];

    public function batch(): BelongsTo
    {
        return $this->belongsTo(Batch::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
