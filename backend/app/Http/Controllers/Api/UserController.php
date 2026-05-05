<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\PaginatesResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    use PaginatesResponse;

    public function index(Request $request)
    {
        $query = User::query();

        if ($request->filled('role')) {
            $query->where('role', $request->role);
        }
        if ($request->filled('q')) {
            $q = $request->q;
            $query->where(fn ($s) => $s
                ->where('name', 'like', "%{$q}%")
                ->orWhere('email', 'like', "%{$q}%"));
        }

        $query->orderBy('name');

        return response()->json($this->paginated($query, $request));
    }

    public function show(User $user)
    {
        return response()->json(['data' => $user]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name'      => 'required|string|max:150',
            'email'     => 'required|email|unique:users,email',
            'password'  => 'required|string|min:8',
            'role'      => ['required', Rule::in(User::ROLES)],
            'phone'     => 'nullable|string|max:30',
            'is_active' => 'boolean',
        ]);

        $user = User::create($data);

        return response()->json(['data' => $user], 201);
    }

    public function update(Request $request, User $user)
    {
        $data = $request->validate([
            'name'      => 'sometimes|string|max:150',
            'email'     => ['sometimes', 'email', Rule::unique('users', 'email')->ignore($user->id)],
            'password'  => 'nullable|string|min:8',
            'role'      => ['sometimes', Rule::in(User::ROLES)],
            'phone'     => 'nullable|string|max:30',
            'is_active' => 'boolean',
        ]);

        // Mencegah owner terakhir di-demote / di-deactivate
        if ($user->isOwner() && (
            (isset($data['role']) && $data['role'] !== User::ROLE_OWNER) ||
            (isset($data['is_active']) && !$data['is_active'])
        )) {
            $ownerCount = User::where('role', User::ROLE_OWNER)->where('is_active', true)->count();
            if ($ownerCount <= 1) {
                return response()->json([
                    'message' => 'Tidak bisa demote/deactivate owner terakhir.',
                ], 422);
            }
        }

        if (empty($data['password'])) {
            unset($data['password']);
        }

        $user->update($data);

        return response()->json(['data' => $user->fresh()]);
    }

    public function destroy(Request $request, User $user)
    {
        if ($user->id === $request->user()->id) {
            return response()->json(['message' => 'Tidak bisa menghapus akun sendiri.'], 422);
        }

        if ($user->isOwner()) {
            $ownerCount = User::where('role', User::ROLE_OWNER)->where('is_active', true)->count();
            if ($ownerCount <= 1) {
                return response()->json([
                    'message' => 'Tidak bisa menghapus owner terakhir.',
                ], 422);
            }
        }

        $user->delete();

        return response()->json(null, 204);
    }
}
