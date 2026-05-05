<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Mortality extends Model
{
    use HasFactory;

    protected $table = 'mortalities';

    protected $fillable = ['batch_id', 'mortality_date', 'count', 'cause', 'notes', 'created_by'];

    protected $casts = [
        'mortality_date' => 'date',
    ];

    public function batch(): BelongsTo
    {
        return $this->belongsTo(Batch::class);
    }
}
