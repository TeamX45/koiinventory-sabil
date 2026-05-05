<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SalesChannel extends Model
{
    use HasFactory;

    protected $table = 'sales_channels';

    protected $fillable = ['code', 'name', 'type', 'is_active'];

    protected $casts = [
        'is_active' => 'boolean',
    ];
}
