<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Grade;

class GradeController extends Controller
{
    public function index()
    {
        return response()->json(['data' => Grade::orderBy('rank')->get()]);
    }

    public function show(Grade $grade)
    {
        return response()->json(['data' => $grade]);
    }
}
