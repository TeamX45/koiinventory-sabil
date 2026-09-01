<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Storage;

class FishType extends Model
{
    use HasFactory;

    protected $fillable = [
        'parent_id', 'code', 'name', 'group', 'description', 'image_path',
        'default_grade_id', 'default_pond_id',
    ];

    protected $appends = ['image_url', 'full_name'];

    /** Jenis induk. Null berarti ini jenis tingkat atas. */
    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    /** Sub-jenis di bawah jenis ini. */
    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id');
    }

    /** Grade bawaan saat varian ini dipilih di form. */
    public function defaultGrade(): BelongsTo
    {
        return $this->belongsTo(Grade::class, 'default_grade_id');
    }

    /** Kolam tujuan bawaan saat varian ini dipilih di form sortir. */
    public function defaultPond(): BelongsTo
    {
        return $this->belongsTo(Pond::class, 'default_pond_id');
    }

    public function isSubType(): bool
    {
        return $this->parent_id !== null;
    }

    /** URL foto acuan yang bisa dipakai langsung oleh frontend. */
    public function getImageUrlAttribute(): ?string
    {
        return $this->image_path ? Storage::disk('public')->url($this->image_path) : null;
    }

    /**
     * Nama lengkap termasuk induknya, mis. "Kohaku — Tancho".
     * Dipakai di dropdown supaya sub-jenis tidak ambigu saat berdiri sendiri.
     */
    public function getFullNameAttribute(): string
    {
        $parentName = $this->relationLoaded('parent') ? $this->parent?->name : null;

        return $parentName ? "{$parentName} — {$this->name}" : $this->name;
    }
}
