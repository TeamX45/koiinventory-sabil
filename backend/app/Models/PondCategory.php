<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PondCategory extends Model
{
    use HasFactory;

    protected $fillable = ['code', 'name', 'description', 'is_breeding', 'is_grow_out'];

    protected $casts = [
        'is_breeding' => 'boolean',
        'is_grow_out' => 'boolean',
    ];

    public function ponds(): HasMany
    {
        return $this->hasMany(Pond::class);
    }
}
