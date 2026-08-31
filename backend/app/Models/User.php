<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasFactory, Notifiable, HasApiTokens;

    public const ROLE_OWNER = 'owner';
    public const ROLE_ADMIN = 'admin';
    public const ROLE_STAFF = 'staff';

    public const ROLES = [self::ROLE_OWNER, self::ROLE_ADMIN, self::ROLE_STAFF];

    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'is_active',
        'avatar',
        'phone',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password'          => 'hashed',
            'is_active'         => 'boolean',
        ];
    }

    public function isOwner(): bool
    {
        return $this->role === self::ROLE_OWNER;
    }

    public function isAdmin(): bool
    {
        return $this->role === self::ROLE_ADMIN;
    }

    public function isStaff(): bool
    {
        return $this->role === self::ROLE_STAFF;
    }

    public function canManageUsers(): bool
    {
        return $this->isOwner();
    }

    /**
     * Boleh ubah master data (grade, jenis ikan, lokasi, kolam, supplier,
     * kategori). Staff hanya boleh membaca — mereka mencatat transaksi,
     * bukan mengubah kerangka datanya.
     */
    public function canManageMaster(): bool
    {
        return $this->isOwner() || $this->isAdmin();
    }

    /**
     * Boleh aksi sensitif yang sulit dilacak balik: batalkan penjualan,
     * selesaikan stok opname (menulis ulang stok permanen), hapus transaksi.
     */
    public function canApproveTransactions(): bool
    {
        return $this->isOwner() || $this->isAdmin();
    }
}
