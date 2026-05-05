<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Harvest extends Model
{
    use HasFactory;

    protected $fillable = [
        'code', 'source_pond_id', 'harvest_date',
        'total_count', 'status', 'notes', 'created_by',
    ];

    protected $casts = [
        'harvest_date' => 'date',
    ];

    public function sourcePond(): BelongsTo
    {
        return $this->belongsTo(Pond::class, 'source_pond_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function batches()
    {
        return Batch::where('source_type', 'harvest')->where('source_id', $this->id);
    }
}
