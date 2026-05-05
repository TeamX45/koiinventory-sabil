<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SalesChannel;

class SalesChannelController extends Controller
{
    public function index()
    {
        return response()->json(['data' => SalesChannel::orderBy('name')->get()]);
    }

    public function show(SalesChannel $salesChannel)
    {
        return response()->json(['data' => $salesChannel]);
    }
}
