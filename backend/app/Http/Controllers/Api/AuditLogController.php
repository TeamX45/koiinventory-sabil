<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Support\PaginatesResponse;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    use PaginatesResponse;

    public function index(Request $request)
    {
        $query = AuditLog::with('user:id,name,email')
            ->orderByDesc('created_at')
            ->orderByDesc('id');

        if ($request->filled('user_id')) {
            $query->where('user_id', $request->user_id);
        }
        if ($request->filled('action')) {
            $query->where('action', $request->action);
        }
        if ($request->filled('subject_type')) {
            $query->where('subject_type', $request->subject_type);
        }
        if ($request->filled('from')) {
            $query->where('created_at', '>=', $request->from);
        }
        if ($request->filled('to')) {
            $query->where('created_at', '<=', $request->to . ' 23:59:59');
        }

        return response()->json($this->paginated($query, $request, defaultPerPage: 50));
    }
}
