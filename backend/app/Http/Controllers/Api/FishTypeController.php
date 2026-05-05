<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FishType;

class FishTypeController extends Controller
{
    public function index()
    {
        return response()->json(['data' => FishType::orderBy('group')->orderBy('name')->get()]);
    }

    public function show(FishType $fishType)
    {
        return response()->json(['data' => $fishType]);
    }
}
