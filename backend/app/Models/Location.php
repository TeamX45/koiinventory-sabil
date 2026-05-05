<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Location extends Model
{
    use HasFactory;

    protected $fillable = ['code', 'name', 'type', 'address', 'notes'];

    public function ponds(): HasMany
    {
        return $this->hasMany(Pond::class);
    }
}
